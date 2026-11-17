import { z } from "zod";

// Temporary integration slot until the account module owns token storage.
// Call setAccessToken from the real login flow; role is always read from /api/session.
export const ACCESS_TOKEN_KEY = "fitkitchen.access-token";
export function setAccessToken(token: string | null) {
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event("fitkitchen:session-change"));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public unfinishedOrderCount: number = 0,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${import.meta.env["VITE_API_BASE_URL"] || ""}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the server. Please try again.", 0, "NETWORK_ERROR");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({
        code: z.string(),
        message: z.string(),
        unfinished_order_count: z.number().optional(),
      })
      .safeParse(body);
    const code = parsed.success ? parsed.data.code : "REQUEST_FAILED";
    const message = parsed.success ? parsed.data.message : "The request failed. Please try again.";
    // Notify the guard without hiding the server's locked/expired-session message.
    if (
      (response.status === 401 || code === "ACCOUNT_LOCKED") &&
      token === sessionStorage.getItem(ACCESS_TOKEN_KEY) &&
      !options.signal?.aborted
    ) {
      window.dispatchEvent(new CustomEvent("fitkitchen:session-invalid", { detail: message }));
    }
    throw new ApiError(
      message,
      response.status,
      code,
      parsed.success ? parsed.data.unfinished_order_count : 0,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      "The server returned an unexpected response. Please try again.",
      response.status,
      "INVALID_RESPONSE",
    );
  return parsed.data;
}

const id = z.string();
const nullableText = z.string().nullable();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const customerSchema = z.object({
  id,
  full_name: z.string(),
  email: z.string(),
  phone: nullableText,
  fitness_goal: nullableText,
  role: z.literal("CUSTOMER"),
  is_locked: z.boolean(),
  created_at: nullableText,
});
export type Customer = z.infer<typeof customerSchema>;
export const paginationSchema = z.object({
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
});
export const customersSchema = z.object({
  success: z.literal(true),
  data: z.array(customerSchema),
  pagination: paginationSchema,
});
export const profileSchema = z.object({
  success: z.literal(true),
  data: customerSchema.extend({
    addresses: z.array(
      z.object({
        id,
        recipient_name: z.string(),
        phone: z.string(),
        address_detail: z.string(),
        is_default: z.boolean().nullable(),
      }),
    ),
    unfinished_order_count: z.number(),
  }),
});
export const ordersSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id,
      created_at: nullableText,
      delivery_date: calendarDate,
      total_amount: z.string(),
      status: nullableText,
      payment_method: z.string(),
      payment_status: nullableText,
    }),
  ),
  pagination: paginationSchema,
});
export const subscriptionsSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id,
      plan_name: z.string(),
      start_date: calendarDate,
      end_date: calendarDate,
      status: z.string(),
      payment_method: z.string(),
      payment_status: nullableText,
      total_amount: z.string(),
    }),
  ),
  pagination: paginationSchema,
});
export const statusSchema = z.object({
  success: z.literal(true),
  data: customerSchema,
  changed: z.boolean(),
});
export const sessionSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id,
    full_name: z.string(),
    role: z.enum(["ADMIN", "CUSTOMER"]),
    is_locked: z.boolean(),
  }),
});
export type Session = z.infer<typeof sessionSchema>["data"];
