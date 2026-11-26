import { z } from "zod";
import { api, paginationSchema } from "@/lib/admin-api";

export const adminPromotionsKey = ["admin", "promotions"] as const;

const requestApi = <S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: RequestInit = {},
): Promise<z.output<S>> => api(path, schema as z.ZodType<z.output<S>>, options);

const id = z.string().regex(/^[1-9]\d*$/);
const amount = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite());
const nullableText = z.string().nullable();

export const promotionSchema = z.object({
  id,
  code: z.string(),
  description: nullableText,
  discount_type: z.enum(["PERCENTAGE", "FIXED"]),
  discount_value: amount,
  min_order_amount: amount,
  max_discount_amount: amount.nullable(),
  start_date: nullableText,
  end_date: nullableText,
  usage_limit: z.number().int().positive().nullable(),
  per_user_limit: z.number().int().positive().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  redemption_count: z.number().int().nonnegative(),
});
export type AdminPromotion = z.infer<typeof promotionSchema>;

const promotionPageSchema = z.object({
  success: z.literal(true),
  data: z.array(promotionSchema),
  pagination: paginationSchema,
});
const promotionResponseSchema = z.object({
  success: z.literal(true),
  data: promotionSchema,
});
const offerSchema = z.object({
  promotion_id: id,
  code: z.string(),
  discount_type: z.enum(["PERCENTAGE", "FIXED"]),
  discount_value: amount,
  subtotal: amount,
  discount_amount: amount,
  total_amount: amount,
});
const offerResponseSchema = z.object({ success: z.literal(true), data: offerSchema });
export type PromotionOffer = z.infer<typeof offerSchema>;

export type PromotionInput = {
  code: string;
  description: string | null;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  is_active: boolean;
};

export const promotionApi = {
  listAdmin: (page = 1, signal?: AbortSignal) =>
    requestApi(`/admin/promotions?page=${page}&page_size=50`, promotionPageSchema, signal ? { signal } : {}),
  createAdmin: (payload: PromotionInput) =>
    requestApi("/admin/promotions", promotionResponseSchema, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAdmin: (id: string, payload: Partial<PromotionInput>) =>
    requestApi(`/admin/promotions/${encodeURIComponent(id)}`, promotionResponseSchema, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  validateForCart: (code: string) =>
    requestApi("/promotions/validate", offerResponseSchema, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};
