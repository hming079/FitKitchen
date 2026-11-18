import { z } from "zod";
import { api, setAccessToken } from "./admin-api";

export const loginSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(1),
    user: z.object({
      id: z.string(),
      full_name: z.string(),
      role: z.enum(["ADMIN", "CUSTOMER"]),
      is_locked: z.boolean(),
    }),
  }),
});

export function login(email: string, password: string) {
  return api("/auth/login", loginSchema, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  const request = api("/auth/logout", z.object({
    success: z.literal(true),
    data: z.object({ signed_out: z.literal(true) }),
  }), { method: "POST" });
  setAccessToken(null);
  return request.then(() => undefined, () => undefined);
}
