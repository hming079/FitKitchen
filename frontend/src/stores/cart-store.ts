import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storefrontApiRequest, type ShopifyPrice, type ShopifyProduct } from "@/lib/shopify";

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: ShopifyPrice;
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartLineNode {
  id: string;
  merchandise: { id: string };
}

interface MutationPayload {
  cart?: {
    id: string;
    checkoutUrl?: string;
    totalQuantity?: number;
    lines?: { edges: Array<{ node: CartLineNode }> };
  } | null;
  userErrors: Array<{ field: string[] | null; message: string }>;
}

const CREATE_CART = `mutation CartCreate($input: CartInput!) {
  cartCreate(input: $input) { cart { id checkoutUrl lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } } userErrors { field message } }
}`;
const ADD_LINES = `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } } userErrors { field message } }
}`;
const UPDATE_LINES = `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { field message } }
}`;
const REMOVE_LINES = `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } userErrors { field message } }
}`;
const GET_CART = `query Cart($id: ID!) { cart(id: $id) { id totalQuantity } }`;

function withChannel(url: string) {
  const checkout = new URL(url);
  checkout.searchParams.set("channel", "online_store");
  return checkout.toString();
}

function cartExpired(errors: MutationPayload["userErrors"]) {
  return errors.some(({ message }) => /cart not found|does not exist/i.test(message));
}

function ensureNoUserErrors(payload: MutationPayload) {
  if (cartExpired(payload.userErrors)) return "expired";
  if (payload.userErrors.length) throw new Error(payload.userErrors.map(({ message }) => message).join(" "));
  return "ok";
}

interface CartState {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  addItem: (item: Omit<CartItem, "lineId">) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,
      error: null,
      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      addItem: async (newItem) => {
        set({ isLoading: true, error: null });
        try {
          const state = get();
          const existing = state.items.find((item) => item.variantId === newItem.variantId);
          if (!state.cartId) {
            const data = await storefrontApiRequest<{ cartCreate: MutationPayload }>(CREATE_CART, {
              input: { lines: [{ quantity: newItem.quantity, merchandiseId: newItem.variantId }] },
            });
            const result = data.cartCreate;
            ensureNoUserErrors(result);
            const cart = result.cart;
            const line = cart?.lines?.edges[0]?.node;
            if (!cart?.checkoutUrl || !line) throw new Error("Shopify did not return a checkout cart.");
            set({
              cartId: cart.id,
              checkoutUrl: withChannel(cart.checkoutUrl),
              items: [{ ...newItem, lineId: line.id }],
            });
            return;
          }
          if (existing?.lineId) {
            const quantity = existing.quantity + newItem.quantity;
            const data = await storefrontApiRequest<{ cartLinesUpdate: MutationPayload }>(UPDATE_LINES, {
              cartId: state.cartId,
              lines: [{ id: existing.lineId, quantity }],
            });
            const result = data.cartLinesUpdate;
            if (ensureNoUserErrors(result) === "expired") {
              get().clearCart();
              return;
            }
            set({ items: get().items.map((item) => item.variantId === newItem.variantId ? { ...item, quantity } : item) });
            return;
          }
          const data = await storefrontApiRequest<{ cartLinesAdd: MutationPayload }>(ADD_LINES, {
            cartId: state.cartId,
            lines: [{ quantity: newItem.quantity, merchandiseId: newItem.variantId }],
          });
          const result = data.cartLinesAdd;
          if (ensureNoUserErrors(result) === "expired") {
            get().clearCart();
            return;
          }
          const line = result.cart?.lines?.edges.find(({ node }) => node.merchandise.id === newItem.variantId)?.node;
          if (!line) throw new Error("Shopify did not return the added meal.");
          set({ items: [...get().items, { ...newItem, lineId: line.id }] });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Unable to add this meal." });
        } finally {
          set({ isLoading: false });
        }
      },
      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) return get().removeItem(variantId);
        const { cartId, items } = get();
        const item = items.find((entry) => entry.variantId === variantId);
        if (!cartId || !item?.lineId) return;
        set({ isLoading: true, error: null });
        try {
          const data = await storefrontApiRequest<{ cartLinesUpdate: MutationPayload }>(UPDATE_LINES, {
            cartId,
            lines: [{ id: item.lineId, quantity }],
          });
          if (ensureNoUserErrors(data.cartLinesUpdate) === "expired") return get().clearCart();
          set({ items: get().items.map((entry) => entry.variantId === variantId ? { ...entry, quantity } : entry) });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Unable to update your cart." });
        } finally {
          set({ isLoading: false });
        }
      },
      removeItem: async (variantId) => {
        const { cartId, items } = get();
        const item = items.find((entry) => entry.variantId === variantId);
        if (!cartId || !item?.lineId) return;
        set({ isLoading: true, error: null });
        try {
          const data = await storefrontApiRequest<{ cartLinesRemove: MutationPayload }>(REMOVE_LINES, {
            cartId,
            lineIds: [item.lineId],
          });
          if (ensureNoUserErrors(data.cartLinesRemove) === "expired") return get().clearCart();
          const remaining = get().items.filter((entry) => entry.variantId !== variantId);
          if (remaining.length === 0) get().clearCart();
          else set({ items: remaining });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Unable to remove this meal." });
        } finally {
          set({ isLoading: false });
        }
      },
      syncCart: async () => {
        const { cartId, isSyncing } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const data = await storefrontApiRequest<{ cart: { id: string; totalQuantity: number } | null }>(GET_CART, { id: cartId });
          if (!data.cart || data.cart.totalQuantity === 0) get().clearCart();
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Unable to sync your cart." });
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "fitfuel-shopify-cart",
      storage: createJSONStorage(() => ({
        getItem: (name) => typeof window === "undefined" ? null : window.localStorage.getItem(name),
        setItem: (name, value) => { if (typeof window !== "undefined") window.localStorage.setItem(name, value); },
        removeItem: (name) => { if (typeof window !== "undefined") window.localStorage.removeItem(name); },
      })),
      partialize: ({ items, cartId, checkoutUrl }) => ({ items, cartId, checkoutUrl }),
      skipHydration: true,
    },
  ),
);