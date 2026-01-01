import { create } from 'zustand';
import { offlineDB, CartItem } from '@azela-pos/offline';

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  discountTotal: number;
  loadCart: () => Promise<void>;
  addItem: (item: Omit<CartItem, 'id' | 'createdAt'>) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  updateItem: (id: number, updates: Partial<CartItem>) => Promise<void>;
  setCustomer: (customerId: string | null, phone: string | null, name?: string | null) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => Promise<void>;
  getTotal: () => { subTotal: number; taxTotal: number; grandTotal: number };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerPhone: null,
  customerName: null,
  discountTotal: 0,
  loadCart: async () => {
    const items = await offlineDB.cart.toArray();
    set({ items });
  },
  addItem: async (item) => {
    const cartItem: CartItem = {
      ...item,
      createdAt: Date.now(),
    };
    const id = await offlineDB.cart.add(cartItem);
    const items = await offlineDB.cart.toArray();
    set({ items });
  },
  removeItem: async (id) => {
    await offlineDB.cart.delete(id);
    const items = await offlineDB.cart.toArray();
    set({ items });
  },
  updateItem: async (id, updates) => {
    await offlineDB.cart.update(id, updates);
    const items = await offlineDB.cart.toArray();
    set({ items });
  },
  setCustomer: (customerId, customerPhone, customerName) => {
    set({ customerId, customerPhone, customerName: customerName ?? null });
  },
  setDiscount: (discountTotal) => {
    set({ discountTotal });
  },
  clearCart: async () => {
    await offlineDB.cart.clear();
    set({ items: [], customerId: null, customerPhone: null, customerName: null, discountTotal: 0 });
  },
  getTotal: () => {
    const { items, discountTotal } = get();
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
    const grandTotal = Math.round((subTotal + taxTotal - discountTotal) * 100) / 100;
    // Round grand total to nearest integer for checkout
    const roundedGrandTotal = Math.round(grandTotal);

    return { subTotal, taxTotal, grandTotal: roundedGrandTotal };
  },
}));

