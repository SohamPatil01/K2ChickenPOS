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
      subTotal += item.lineTotal;
      taxTotal += item.lineTotal * (item.taxRate / 100);
    }

    const grandTotal = subTotal + taxTotal - discountTotal;

    return { subTotal, taxTotal, grandTotal };
  },
}));

