import { z } from "zod";
import { api, paginationSchema, sessionSchema } from "@/lib/admin-api";

function requestApi<S extends z.ZodTypeAny>(path: string, schema: S, options: RequestInit = {}) {
  return api(path, schema as unknown as z.ZodType<z.output<S>>, options);
}

const id = z.string().regex(/^[1-9]\d*$/);
const amount = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().finite());
const optionSchema = z.object({
  id,
  name: z.string(),
  price_adjustment: amount,
  calories_adjustment: amount,
  protein_g_adjustment: amount,
  carbs_g_adjustment: amount,
  fat_g_adjustment: amount,
});
const cartItemSchema = z.object({
  id,
  meal_id: id,
  quantity: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  price: amount,
  calories: amount,
  protein_g: amount,
  carbs_g: amount,
  fat_g: amount,
  unit_price: amount,
  line_total: amount,
  customizations: z.array(optionSchema),
});
export const cartSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id,
    items: z.array(cartItemSchema),
    item_count: z.number().int().nonnegative(),
    subtotal: amount,
    currency: z.literal("VND"),
  }),
});
export type Cart = z.infer<typeof cartSchema>["data"];
export type CartItem = z.infer<typeof cartItemSchema>;

const addressSchema = z.object({
  id,
  recipient_name: z.string(),
  phone: z.string(),
  address_detail: z.string(),
  is_default: z.boolean().nullable(),
});
const addressesSchema = z.object({ success: z.literal(true), data: z.array(addressSchema) });
export type Address = z.infer<typeof addressSchema>;

const orderItemSchema = z.object({
  id: id.optional(),
  meal_id: id.nullable(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: amount,
  calories_snapshot: amount.optional(),
  protein_snapshot: amount.optional(),
  carbs_snapshot: amount.optional(),
  fat_snapshot: amount.optional(),
  options: z.array(optionSchema).nullable().optional(),
  customizations: z.array(optionSchema).optional(),
});
export const orderSchema = z.object({
  id,
  created_at: z.string().nullable(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: amount,
  shipping_fee: amount,
  status: z.string(),
  payment_method: z.string(),
  payment_status: z.string().nullable(),
  delivery_time_slot: z.string().nullable(),
  items_summary: z.string().optional(),
  items: z.array(orderItemSchema).optional(),
});
export type Order = z.infer<typeof orderSchema>;
const successOrder = z.object({ success: z.literal(true), data: orderSchema });

export type PaymentMethod = "COD" | "ONLINE";
// The only payment page the storefront may send customers to (VNPay Sandbox).
export const VNPAY_ORIGIN = "https://sandbox.vnpayment.vn";

/** Returns the URL only when it is a well-formed https URL on the VNPay origin. */
export function vnpayRedirectUrl(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === VNPAY_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

// Indirection so tests can observe navigation without replacing window.location.
export const browserNavigation = {
  assign: (url: string) => window.location.assign(url),
};

/** Opens the VNPay page only for a trusted URL; returns false when the URL is rejected. */
export function openVnpayPage(value: string | null | undefined) {
  const url = vnpayRedirectUrl(value);
  if (!url) return false;
  browserNavigation.assign(url);
  return true;
}

const checkoutPaymentSchema = z.object({
  provider: z.literal("VNPAY"),
  redirect_url: z.string().nullable(),
});
const successCheckout = z.object({
  success: z.literal(true),
  data: orderSchema.extend({ payment: checkoutPaymentSchema.optional() }),
});
export type CheckoutOrder = z.infer<typeof successCheckout>["data"];

const vnpayPaymentSchema = z.object({
  success: z.literal(true),
  data: z.object({
    provider: z.literal("VNPAY"),
    order_id: id,
    txn_ref: z.string(),
    expires_at: z.string(),
    redirect_url: z.string(),
  }),
});
const paymentStatusSchema = z.object({
  success: z.literal(true),
  data: z.object({
    order_id: id,
    order_status: z.string(),
    payment_method: z.string(),
    payment_status: z.string(),
    total_amount: amount,
    can_retry: z.boolean(),
    latest_transaction: z
      .object({
        txn_ref: z.string(),
        status: z.string(),
        response_code: z.string().nullable(),
        expires_at: z.string(),
        created_at: z.string(),
      })
      .nullable(),
  }),
});
export type PaymentStatus = z.infer<typeof paymentStatusSchema>["data"];

/** Mirrors the backend rule for creating a new VNPay URL; the backend still decides. */
export function canPayOnline(order: Pick<Order, "payment_method" | "status" | "payment_status">) {
  return (
    order.payment_method === "ONLINE" &&
    order.status === "PENDING" &&
    (order.payment_status === "PENDING" || order.payment_status === "FAILED")
  );
}
const ordersSchema = z.object({
  success: z.literal(true),
  data: z.array(orderSchema),
  pagination: paginationSchema,
});
const successAddresses = addressesSchema;

export const orderApi = {
  session: (signal?: AbortSignal) =>
    requestApi("/session", sessionSchema, signal ? { signal } : {}),
  cart: () => requestApi("/cart", cartSchema),
  addItem: (meal_id: string, quantity: number, option_ids: string[]) =>
    requestApi("/cart/items", cartSchema, {
      method: "POST",
      body: JSON.stringify({ meal_id, quantity, option_ids }),
    }),
  updateItem: (itemId: string, quantity: number) =>
    requestApi(`/cart/items/${encodeURIComponent(itemId)}`, cartSchema, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (itemId: string) =>
    requestApi(`/cart/items/${encodeURIComponent(itemId)}`, cartSchema, { method: "DELETE" }),
  clearCart: () => requestApi("/cart", cartSchema, { method: "DELETE" }),
  addresses: (userId: string, signal?: AbortSignal) =>
    requestApi(
      `/users/${encodeURIComponent(userId)}/addresses`,
      successAddresses,
      signal ? { signal } : {},
    ),
  saveAddress: (
    userId: string,
    payload: Pick<Address, "recipient_name" | "phone" | "address_detail"> & {
      is_default?: boolean;
    },
  ) =>
    requestApi(
      `/users/${encodeURIComponent(userId)}/addresses`,
      z.object({ success: z.literal(true), data: addressSchema }),
      { method: "POST", body: JSON.stringify(payload) },
    ),
  checkout: (payload: {
    address_id: string;
    delivery_date: string;
    delivery_time_slot?: string;
    payment_method?: PaymentMethod;
  }) =>
    requestApi("/orders/checkout", successCheckout, {
      method: "POST",
      body: JSON.stringify({ payment_method: "COD", ...payload }),
    }),
  createVnpayPayment: (orderId: string) =>
    requestApi("/payments/vnpay", vnpayPaymentSchema, {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    }),
  paymentStatus: (orderId: string, signal?: AbortSignal) =>
    requestApi(
      `/payments/orders/${encodeURIComponent(orderId)}`,
      paymentStatusSchema,
      signal ? { signal } : {},
    ),
  orders: (signal?: AbortSignal) =>
    requestApi("/orders?page=1&page_size=20", ordersSchema, signal ? { signal } : {}),
  order: (id: string, signal?: AbortSignal) =>
    requestApi(`/orders/${encodeURIComponent(id)}`, successOrder, signal ? { signal } : {}),
  cancelOrder: (id: string) =>
    requestApi(`/orders/${encodeURIComponent(id)}/cancel`, successOrder, {
      method: "PATCH",
    }),
};
