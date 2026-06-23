import { create } from 'zustand';
import { offlineDB, CartItem } from '@azela-pos/offline';
import { LOYALTY_POINT_VALUE } from '@azela-pos/shared';

export type FulfillmentType = 'PICKUP' | 'DELIVERY';

function roundedRate(rate: number): number {
  return Math.round(rate * 100) / 100;
}

/** Same catalog line (e.g. same masale twice): merge qty instead of a second row */
function findMergeableCartLine(
  items: CartItem[],
  incoming: Omit<CartItem, 'id' | 'createdAt'>
): number {
  if (incoming.productId === 'manual') return -1;

  return items.findIndex((ex) => {
    if (!ex.id) return false;
    if (ex.productId !== incoming.productId) return false;
    if (roundedRate(ex.rate) !== roundedRate(incoming.rate)) return false;
    if (ex.taxRate !== incoming.taxRate) return false;

    const exM = ex.metaJson || {};
    const inM = incoming.metaJson || {};
    if (exM.manualEntry || inM.manualEntry) return false;

    const exKg = ex.qtyKg ?? 0;
    const exPcs = ex.qtyPcs ?? 0;
    const inKg = incoming.qtyKg ?? 0;
    const inPcs = incoming.qtyPcs ?? 0;

    const exPcsOnly = exPcs > 0 && exKg === 0;
    const inPcsOnly = inPcs > 0 && inKg === 0;
    const exKgOnly = exKg > 0 && exPcs === 0;
    const inKgOnly = inKg > 0 && inPcs === 0;

    return (exPcsOnly && inPcsOnly) || (exKgOnly && inKgOnly);
  });
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  customerArea: string | null;
  discountTotal: number;
  discountType: 'amount' | 'percentage';
  discountPercentage: number;
  fulfillmentType: FulfillmentType;
  deliveryFee: number;
  /** Loyalty points the customer is redeeming on this bill (1 point = ₹1). */
  loyaltyRedeemPoints: number;
  loadCart: () => Promise<void>;
  addItem: (item: Omit<CartItem, 'id' | 'createdAt'>) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  updateItem: (id: number, updates: Partial<CartItem>) => Promise<void>;
  setCustomer: (customerId: string | null, phone: string | null, name?: string | null, area?: string | null) => void;
  setDiscount: (amount: number) => void;
  setDiscountType: (type: 'amount' | 'percentage') => void;
  setDiscountPercentage: (percentage: number) => void;
  setFulfillmentType: (type: FulfillmentType) => void;
  setDeliveryFee: (fee: number) => void;
  setLoyaltyRedeemPoints: (points: number) => void;
  clearCart: () => Promise<void>;
  getTotal: () => {
    subTotal: number;
    taxTotal: number;
    deliveryFee: number;
    grandTotal: number;
    /** ₹ amount knocked off the bill by redeemed loyalty points. */
    loyaltyDiscount: number;
    /** Points actually applied after capping to balance/bill. */
    loyaltyPointsApplied: number;
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerPhone: null,
  customerName: null,
  customerArea: null,
  discountTotal: 0,
  discountType: 'amount',
  discountPercentage: 0,
  fulfillmentType: 'PICKUP',
  deliveryFee: 0,
  loyaltyRedeemPoints: 0,
  loadCart: async () => {
    try {
      const items = await offlineDB.cart.toArray();
      console.log('Cart loaded:', items.length, 'items', items);
      // Ensure items is always an array
      const itemsArray = Array.isArray(items) ? items : [];
      console.log('Setting items in store:', itemsArray.length, itemsArray);
      set({ items: itemsArray });
      // Force a small delay to ensure state update
      return Promise.resolve();
    } catch (error) {
      console.error('Error loading cart:', error);
      set({ items: [] });
    }
  },
  addItem: async (item) => {
    try {
      const items = await offlineDB.cart.toArray();
      const mergeIdx = findMergeableCartLine(items, item);

      if (mergeIdx >= 0) {
        const ex = items[mergeIdx];
        const exKg = ex.qtyKg ?? 0;
        const exPcs = ex.qtyPcs ?? 0;
        const inKg = item.qtyKg ?? 0;
        const inPcs = item.qtyPcs ?? 0;

        const exPcsOnly = exPcs > 0 && exKg === 0;
        let newPcs = exPcs;
        let newKg = exKg;
        if (exPcsOnly) {
          newPcs = exPcs + inPcs;
        } else {
          newKg = Math.round((exKg + inKg) * 1000) / 1000;
        }

        const lineTotal =
          exPcsOnly && newKg === 0
            ? Math.round(newPcs * ex.rate * 100) / 100
            : Math.round(newKg * ex.rate * 100) / 100;

        await offlineDB.cart.update(ex.id!, {
          ...(exPcsOnly
            ? { qtyPcs: newPcs, qtyKg: undefined }
            : { qtyKg: newKg, qtyPcs: undefined }),
          lineTotal,
        });
      } else {
        const cartItem: CartItem = {
          ...item,
          createdAt: Date.now(),
        };
        await offlineDB.cart.add(cartItem);
      }

      const next = await offlineDB.cart.toArray();
      set({ items: next });
    } catch (error) {
      console.error('Error adding item to cart:', error);
    }
  },
  removeItem: async (id) => {
    try {
      console.log('Removing item with ID:', id);
      await offlineDB.cart.delete(id);
      const items = await offlineDB.cart.toArray();
      console.log('Cart after remove:', items.length, 'items');
      set({ items });
    } catch (error) {
      console.error('Error removing item:', error);
    }
  },
  updateItem: async (id, updates) => {
    await offlineDB.cart.update(id, updates);
    const items = await offlineDB.cart.toArray();
    set({ items });
  },
  setCustomer: (customerId, customerPhone, customerName, customerArea) => {
    const name = customerName ? String(customerName) : null;
    const areaUpdate =
      customerArea !== undefined
        ? { customerArea: customerArea ? String(customerArea).trim() || null : null }
        : {};
    console.log('[Cart Store] setCustomer called:', { customerId, customerPhone, customerName: name, customerArea });
    // Points belong to a specific customer — clear any pending redemption when
    // the attached customer changes (or is removed).
    if (!customerId) {
      set({ customerId, customerPhone, customerName: name, ...areaUpdate, fulfillmentType: 'PICKUP', loyaltyRedeemPoints: 0 });
      return;
    }
    set({ customerId, customerPhone, customerName: name, ...areaUpdate, loyaltyRedeemPoints: 0 });
  },
  setDiscount: (discountTotal) => {
    set({ discountTotal });
  },
  setDiscountType: (discountType) => {
    set({ discountType, discountTotal: 0, discountPercentage: 0 });
  },
  setDiscountPercentage: (discountPercentage) => {
    set({ discountPercentage });
    // Calculate discount amount from percentage
    const { items } = get();
    let subTotal = 0;
    for (const item of items) {
      const baseLineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
      subTotal += baseLineTotal;
    }
    // Round subTotal to 2 decimal places before calculating discount
    subTotal = Math.round(subTotal * 100) / 100;
    const discountAmount = (subTotal * discountPercentage) / 100;
    set({ discountTotal: discountAmount });
  },
  setFulfillmentType: (fulfillmentType: FulfillmentType) => {
    set(
      fulfillmentType === 'PICKUP'
        ? { fulfillmentType, deliveryFee: 0 }
        : { fulfillmentType }
    );
  },
  setDeliveryFee: (deliveryFee: number) => {
    const fee = Math.max(0, Math.round(deliveryFee));
    set({ deliveryFee: fee });
  },
  setLoyaltyRedeemPoints: (points: number) => {
    const safe = Math.max(0, Math.floor(Number(points) || 0));
    set({ loyaltyRedeemPoints: safe });
  },
  clearCart: async () => {
    await offlineDB.cart.clear();
    set({ items: [], customerId: null, customerPhone: null, customerName: null, customerArea: null, discountTotal: 0, discountType: 'amount', discountPercentage: 0, fulfillmentType: 'PICKUP', deliveryFee: 0, loyaltyRedeemPoints: 0 });
  },
  getTotal: () => {
    const { items, discountTotal, discountType, discountPercentage, deliveryFee, fulfillmentType, loyaltyRedeemPoints } = get();
    const effectiveDeliveryFee = fulfillmentType === 'DELIVERY' ? deliveryFee : 0;
    let subTotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      // Calculate base line total (qty * rate) - matching backend logic
      const baseLineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
      subTotal += baseLineTotal;
      // Calculate tax on base amount - matching backend logic
      taxTotal += baseLineTotal * (item.taxRate / 100);
    }

    // Round to 2 decimal places to avoid floating point precision issues
    subTotal = Math.round(subTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    
    // Calculate discount based on type
    let calculatedDiscount = discountTotal;
    if (discountType === 'percentage' && discountPercentage > 0) {
      calculatedDiscount = (subTotal * discountPercentage) / 100;
    }
    // Round discount to 2 decimal places
    calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;
    
    const grandTotal = Math.round((subTotal + taxTotal - calculatedDiscount + effectiveDeliveryFee) * 100) / 100;
    // Round grand total to nearest integer for checkout
    const roundedGrandTotal = Math.round(grandTotal);

    // Apply loyalty redemption last (1 point = ₹LOYALTY_POINT_VALUE). Cap so the
    // bill never goes below zero; this mirrors the server-side calculation.
    const requestedPoints = Math.max(0, Math.floor(loyaltyRedeemPoints || 0));
    const maxRedeemableValue = roundedGrandTotal;
    const loyaltyDiscount = Math.min(requestedPoints * LOYALTY_POINT_VALUE, maxRedeemableValue);
    const loyaltyPointsApplied = Math.floor(loyaltyDiscount / LOYALTY_POINT_VALUE);
    const finalGrandTotal = roundedGrandTotal - loyaltyDiscount;

    return {
      subTotal,
      taxTotal,
      deliveryFee: effectiveDeliveryFee,
      grandTotal: finalGrandTotal,
      loyaltyDiscount,
      loyaltyPointsApplied,
    };
  },
}));

