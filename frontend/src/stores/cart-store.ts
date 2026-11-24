import { create } from "zustand";
import { ApiError } from "@/lib/admin-api";
import { orderApi, type Cart, type CartItem } from "@/lib/order-api";

interface CartState {
  items: CartItem[];
  cartId: string | null;
  subtotal: number;
  itemCount: number;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadCart: () => Promise<void>;
  addItem: (mealId: string, optionIds?: string[]) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  replace: (cart: Cart) => void;
  reset: () => void;
}

function messageFor(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return "Sign in to add meals and view your cart.";
  if (error instanceof ApiError && error.status === 403)
    return "A customer account is required to use the cart.";
  return error instanceof Error ? error.message : "Could not update your cart. Please try again.";
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cartId: null,
  subtotal: 0,
  itemCount: 0,
  isLoading: false,
  isLoaded: false,
  error: null,
  replace: (cart) =>
    set({
      items: cart.items,
      cartId: cart.id,
      subtotal: cart.subtotal,
      itemCount: cart.item_count,
      isLoaded: true,
      error: null,
    }),
  reset: () =>
    set({
      items: [],
      cartId: null,
      subtotal: 0,
      itemCount: 0,
      isLoading: false,
      isLoaded: false,
      error: null,
    }),
  loadCart: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      get().replace((await orderApi.cart()).data);
    } catch (error) {
      set({ error: messageFor(error), isLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },
  addItem: async (mealId, optionIds = []) => {
    set({ isLoading: true, error: null });
    try {
      get().replace((await orderApi.addItem(mealId, 1, optionIds)).data);
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  updateQuantity: async (itemId, quantity) => {
    set({ isLoading: true, error: null });
    try {
      get().replace((await orderApi.updateItem(itemId, quantity)).data);
    } catch (error) {
      set({ error: messageFor(error) });
    } finally {
      set({ isLoading: false });
    }
  },
  removeItem: async (itemId) => {
    set({ isLoading: true, error: null });
    try {
      get().replace((await orderApi.removeItem(itemId)).data);
    } catch (error) {
      set({ error: messageFor(error) });
    } finally {
      set({ isLoading: false });
    }
  },
}));
