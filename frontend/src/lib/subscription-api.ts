import { z } from "zod";
import { api, paginationSchema } from "@/lib/admin-api";

export const adminSubscriptionsKey = ["admin", "subscriptions"] as const;

function requestApi<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: RequestInit = {},
): Promise<z.output<S>> {
  return api(path, schema as unknown as z.ZodType<z.output<S>>, options);
}

const id = z.string().regex(/^[1-9]\d*$/);
const nullableText = z.string().nullable();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite());

export const subscriptionGiftSchema = z.object({
  id,
  product_id: id.nullable(),
  product_name: nullableText,
  gift_name: z.string(),
  description: nullableText,
  quantity: z.number().int().positive(),
  status: nullableText.optional(),
});
export type SubscriptionGift = z.infer<typeof subscriptionGiftSchema>;

export const subscriptionPlanSchema = z.object({
  id,
  name: z.string(),
  description: nullableText,
  duration_days: z.number().int().positive(),
  meals_per_day: z.number().int().positive(),
  price: amount,
  is_active: z.boolean().nullable(),
  gifts: z.array(subscriptionGiftSchema),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const adminSubscriptionPlanSchema = subscriptionPlanSchema.extend({
  in_progress_count: z.number().int().nonnegative(),
  pending_count: z.number().int().nonnegative(),
});
export type AdminSubscriptionPlan = z.infer<typeof adminSubscriptionPlanSchema>;

export const checkoutWindowSchema = z.object({
  earliest_start_date: calendarDate,
  latest_start_date: calendarDate,
});
export type CheckoutWindow = z.infer<typeof checkoutWindowSchema>;

export const subscriptionPhaseSchema = z.enum([
  "IN_PROGRESS",
  "UPCOMING",
  "PENDING",
  "ENDED",
  "CANCELLED",
]);
export type SubscriptionPhase = z.infer<typeof subscriptionPhaseSchema>;

export const customerSubscriptionSchema = z.object({
  id,
  plan_id: id,
  plan_name: z.string(),
  duration_days: z.number().int().positive(),
  meals_per_day: z.number().int().positive(),
  start_date: calendarDate,
  end_date: calendarDate,
  status: z.string(),
  phase: subscriptionPhaseSchema,
  payment_method: z.string(),
  payment_status: nullableText,
  total_amount: amount,
  created_at: nullableText,
  recipient_name: nullableText,
  address_phone: nullableText,
  address_detail: nullableText,
  gifts: z.array(subscriptionGiftSchema),
});
export type CustomerSubscription = z.infer<typeof customerSubscriptionSchema>;

export const adminSubscriptionSchema = customerSubscriptionSchema.extend({
  user_id: id,
  customer_name: z.string(),
  customer_email: z.string(),
  customer_phone: nullableText,
});
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>;

export const userAddressSchema = z.object({
  id,
  user_id: id.optional(),
  recipient_name: z.string(),
  phone: z.string(),
  address_detail: z.string(),
  is_default: z.boolean().nullable(),
});
export type UserAddress = z.infer<typeof userAddressSchema>;

export type GiftInput = {
  product_id: string | null;
  gift_name: string;
  description: string | null;
  quantity: number;
};

export type PlanPayload = {
  name: string;
  description: string | null;
  duration_days: number;
  meals_per_day: number;
  price: number;
  is_active: boolean;
  gifts: GiftInput[];
};

export type AdminSubscriptionView =
  "all" | "in_progress" | "upcoming" | "pending" | "ended" | "cancelled";

const publicPlansResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(subscriptionPlanSchema),
  checkout_window: checkoutWindowSchema,
});

const publicPlanResponseSchema = z.object({
  success: z.literal(true),
  data: subscriptionPlanSchema,
  checkout_window: checkoutWindowSchema,
});

const customerSubscriptionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(customerSubscriptionSchema),
});

const checkoutResponseSchema = z.object({
  success: z.literal(true),
  data: customerSubscriptionSchema,
});

const addressesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userAddressSchema),
});

const addressResponseSchema = z.object({
  success: z.literal(true),
  data: userAddressSchema,
});

const adminPlansResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(adminSubscriptionPlanSchema),
});

const adminPlanResponseSchema = z.object({
  success: z.literal(true),
  data: adminSubscriptionPlanSchema,
});

const adminSubscriptionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(adminSubscriptionSchema),
  pagination: paginationSchema,
});

const adminSubscriptionMutationSchema = z.object({
  success: z.literal(true),
  data: adminSubscriptionSchema,
  changed: z.boolean(),
});

// Pure calendar math on YYYY-MM-DD strings without local timezone shift.
export function computeEndDate(startDate: string, durationDays: number): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !Number.isInteger(durationDays) ||
    durationDays < 1
  ) {
    return null;
  }
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const startUtc = new Date(Date.UTC(y, m - 1, d));
  if (
    startUtc.getUTCFullYear() !== y ||
    startUtc.getUTCMonth() !== m - 1 ||
    startUtc.getUTCDate() !== d
  ) {
    return null;
  }
  startUtc.setUTCDate(startUtc.getUTCDate() + durationDays - 1);
  const year = startUtc.getUTCFullYear();
  const month = String(startUtc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(startUtc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function validateStartDateInWindow(
  startDate: string,
  durationDays: number,
  window: CheckoutWindow | undefined,
  existing: readonly Pick<
    CustomerSubscription,
    "status" | "start_date" | "end_date" | "plan_name"
  >[] = [],
): { valid: boolean; endDate: string | null; error: string | null } {
  if (!startDate) {
    return { valid: false, endDate: null, error: "Choose a start date." };
  }
  const endDate = computeEndDate(startDate, durationDays);
  if (!endDate) {
    return { valid: false, endDate: null, error: "Enter a valid calendar date (YYYY-MM-DD)." };
  }
  if (window) {
    if (startDate < window.earliest_start_date || startDate > window.latest_start_date) {
      return {
        valid: false,
        endDate,
        error: `Start date must be between ${formatCalendarDate(window.earliest_start_date)} and ${formatCalendarDate(window.latest_start_date)}.`,
      };
    }
  }
  const overlap = existing.find(
    (sub) =>
      (sub.status === "PENDING" || sub.status === "ACTIVE") &&
      sub.start_date <= endDate &&
      sub.end_date >= startDate,
  );
  if (overlap) {
    return {
      valid: false,
      endDate,
      error: `Your plan “${overlap.plan_name}” already covers ${formatCalendarDate(overlap.start_date)}–${formatCalendarDate(overlap.end_date)}. Choose a start date after ${formatCalendarDate(overlap.end_date)}.`,
    };
  }
  return { valid: true, endDate, error: null };
}

export const subscriptionApi = {
  listPublicPlans: (signal?: AbortSignal) =>
    requestApi("/subscription-plans", publicPlansResponseSchema, signal ? { signal } : {}),
  getPublicPlan: (planId: string, signal?: AbortSignal) =>
    requestApi(
      `/subscription-plans/${encodeURIComponent(planId)}`,
      publicPlanResponseSchema,
      signal ? { signal } : {},
    ),
  listMySubscriptions: (signal?: AbortSignal) =>
    requestApi("/subscriptions/me", customerSubscriptionsResponseSchema, signal ? { signal } : {}),
  checkout: (payload: {
    plan_id: string;
    address_id: string;
    start_date: string;
    payment_method?: "COD";
  }) =>
    requestApi("/subscriptions/checkout", checkoutResponseSchema, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listAddresses: (userId: string, signal?: AbortSignal) =>
    requestApi(
      `/users/${encodeURIComponent(userId)}/addresses`,
      addressesResponseSchema,
      signal ? { signal } : {},
    ),
  createAddress: (
    userId: string,
    payload: {
      recipient_name: string;
      phone: string;
      address_detail: string;
      is_default?: boolean;
    },
  ) =>
    requestApi(`/users/${encodeURIComponent(userId)}/addresses`, addressResponseSchema, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listAdminPlans: (signal?: AbortSignal) =>
    requestApi("/admin/subscription-plans", adminPlansResponseSchema, signal ? { signal } : {}),
  createAdminPlan: (payload: PlanPayload) =>
    requestApi("/admin/subscription-plans", adminPlanResponseSchema, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAdminPlan: (planId: string, payload: Partial<PlanPayload>) =>
    requestApi(`/admin/subscription-plans/${encodeURIComponent(planId)}`, adminPlanResponseSchema, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  listAdminSubscriptions: (
    params: {
      search: string;
      view: AdminSubscriptionView;
      plan_id: string;
      page: number;
    },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      search: params.search,
      view: params.view,
      plan_id: params.plan_id,
      page: String(params.page),
    });
    return requestApi(
      `/admin/subscriptions?${query}`,
      adminSubscriptionsResponseSchema,
      signal ? { signal } : {},
    );
  },
  updateAdminSubscription: (
    subscriptionId: string,
    payload: { status?: "ACTIVE" | "CANCELLED"; payment_status?: "PAID" },
  ) =>
    requestApi(
      `/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
      adminSubscriptionMutationSchema,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
};
