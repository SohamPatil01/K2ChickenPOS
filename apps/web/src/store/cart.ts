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
      const cartItem: CartItem = {
        ...item,
        createdAt: Date.now(),
      };
      console.log('Adding item to cart:', cartItem);
      const id = await offlineDB.cart.add(cartItem);
      console.log('Item added with ID:', id);
      // Reload items to get the id that was assigned
      const items = await offlineDB.cart.toArray();
      console.log('Cart after add:', items.length, 'items');
      set({ items });
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

