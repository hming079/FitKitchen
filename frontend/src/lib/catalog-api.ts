import { z } from "zod";
import { ACCESS_TOKEN_KEY, api, ApiError } from "@/lib/admin-api";

const id = z.string().regex(/^[1-9]\d*$/);
const text = z.string().nullable();
const numeric = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite());
const availability = z.boolean().nullable();
const pagination = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
});
export const mealTypes = ["SINGLE", "COMBO_7_DAYS", "TOPPING"] as const;
const mealType = z.enum(mealTypes);
export const goalTypes = ["BULK", "CUT", "MAINTAIN"] as const;
const goalType = z.enum(goalTypes);

const categoryRecord = z.object({ id, name: z.string(), description: text });
const categorySchema = categoryRecord.extend({ meal_count: z.number().int().nonnegative() });
const mealSchema = z.object({
  id,
  category_id: id.nullable(),
  name: z.string(),
  description: text,
  image_url: text,
  price: numeric,
  calories: numeric,
  protein_g: numeric,
  carbs_g: numeric,
  fat_g: numeric,
  meal_type: mealType.nullable(),
  goal_type: goalType.nullable(),
  allergen_info: text,
  is_available: availability,
});
const optionSchema = z.object({
  id,
  meal_id: id,
  name: z.string(),
  description: text,
  price_adjustment: numeric,
  calories_adjustment: numeric,
  protein_g_adjustment: numeric,
  carbs_g_adjustment: numeric,
  fat_g_adjustment: numeric,
  is_available: availability,
});
const productSchema = z.object({
  id,
  name: z.string(),
  description: text,
  category: text,
  image_url: text,
  price: numeric,
  stock_quantity: z.number().int().nonnegative(),
  unit: text,
  is_available: availability,
});

export type Category = z.infer<typeof categorySchema>;
export type Meal = z.infer<typeof mealSchema>;
export type MealOption = z.infer<typeof optionSchema>;
export type Product = z.infer<typeof productSchema>;
export type MealType = z.infer<typeof mealType>;
export type GoalType = z.infer<typeof goalType>;
type MealFields = Omit<Meal, "id" | "meal_type" | "is_available"> & {
  meal_type?: MealType | undefined;
  is_available: boolean;
};
type OptionFields = Omit<MealOption, "id" | "meal_id" | "is_available"> & {
  is_available: boolean;
};
type ProductFields = Omit<Product, "id" | "stock_quantity" | "is_available"> & {
  stock_quantity?: number;
  is_available: boolean;
};
type CategoryFields = Pick<Category, "name" | "description">;
type ListFilters = {
  search?: string;
  available?: "all" | "true" | "false";
  page?: number;
  page_size?: number;
};
type MealFilters = ListFilters & {
  category_id?: string | undefined;
  meal_type?: MealType;
  goal_type?: GoalType | undefined;
  sort?:
    | "id"
    | "price_asc"
    | "price_desc"
    | "calories_asc"
    | "calories_desc"
    | "protein_desc"
    | "newest";
};
type ProductFilters = ListFilters & {
  category?: string | undefined;
  in_stock?: boolean | undefined;
};

function result<T extends z.ZodTypeAny>(data: T) {
  return z.object({ success: z.literal(true), data });
}

function pageResult<T extends z.ZodTypeAny>(record: T) {
  return result(z.array(record)).extend({ pagination });
}

function withQuery(path: string, filters: Record<string, string | boolean | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return `${path}?${query}`;
}

function parseResult<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      "The server returned an unexpected catalog response.",
      200,
      "INVALID_RESPONSE",
    );
  return parsed.data;
}

async function request<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  options?: RequestInit,
): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await api(path, z.unknown(), options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.code === "REQUEST_FAILED")
      throw new ApiError(
        "Some catalog values were rejected. Check the fields and try again.",
        400,
        error.code,
      );
    throw error;
  }
  return parseResult(schema, body);
}

function write<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  method: "POST" | "PATCH" | "DELETE",
  body?: object,
) {
  return request(path, result(schema), { method, body: JSON.stringify(body) });
}

const categoryDeleteError = z.object({
  code: z.string(),
  message: z.string(),
  meal_count: z.number().int().positive().optional(),
});

// This endpoint reports the exact reference count in its error body, which api() does not expose.
async function deleteCategory(categoryId: string) {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env["VITE_API_BASE_URL"] || ""}/api/meal-categories/${encodeURIComponent(categoryId)}`,
      { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
  } catch {
    throw new ApiError("Could not reach the server. Please try again.", 0, "NETWORK_ERROR");
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return parseResult(result(z.object({ id })), body);

  const parsed = categoryDeleteError.safeParse(body);
  const code = parsed.success ? parsed.data.code : "REQUEST_FAILED";
  let message = parsed.success
    ? parsed.data.message
    : "Could not delete category. Please try again.";
  if (response.status === 409 && code === "CATEGORY_IN_USE") {
    const count = parsed.success ? parsed.data.meal_count : undefined;
    const reference = count
      ? `${count} ${count === 1 ? "meal still uses" : "meals still use"}`
      : "Meals still use";
    message = `${reference} this category. Move them to another category first.`;
  }
  if (
    (response.status === 401 || code === "ACCOUNT_LOCKED") &&
    token === sessionStorage.getItem(ACCESS_TOKEN_KEY)
  ) {
    window.dispatchEvent(new CustomEvent("fitkitchen:session-invalid", { detail: message }));
  }
  throw new ApiError(message, response.status, code);
}

const mealPath = (mealId: string) => `/meals/${encodeURIComponent(mealId)}`;
const optionsPath = (mealId: string) => `${mealPath(mealId)}/customizations`;
const productPath = (productId: string) => `/products/${encodeURIComponent(productId)}`;

export const catalogApi = {
  listMeals: (filters: MealFilters, signal?: AbortSignal) =>
    request(withQuery("/meals/manage", filters), pageResult(mealSchema), {
      signal: signal ?? null,
    }),
  createMeal: (fields: MealFields) => write("/meals", mealSchema, "POST", fields),
  updateMeal: (id: string, fields: Partial<MealFields>) =>
    write(mealPath(id), mealSchema, "PATCH", fields),
  archiveMeal: (id: string) => write(mealPath(id), mealSchema, "PATCH", { is_available: false }),
  listOptions: (mealId: string, signal?: AbortSignal) =>
    request(`${optionsPath(mealId)}/manage`, result(z.array(optionSchema)), {
      signal: signal ?? null,
    }),
  createOption: (mealId: string, fields: OptionFields) =>
    write(optionsPath(mealId), optionSchema, "POST", fields),
  updateOption: (mealId: string, id: string, fields: Partial<OptionFields>) =>
    write(`${optionsPath(mealId)}/${encodeURIComponent(id)}`, optionSchema, "PATCH", fields),
  archiveOption: (mealId: string, id: string) =>
    write(`${optionsPath(mealId)}/${encodeURIComponent(id)}`, optionSchema, "DELETE"),
  listCategories: (signal?: AbortSignal) =>
    api("/meal-categories", result(z.array(categorySchema)), { signal: signal ?? null }),
  createCategory: (fields: CategoryFields) =>
    write("/meal-categories", categoryRecord, "POST", fields),
  updateCategory: (id: string, fields: Partial<CategoryFields>) =>
    write(`/meal-categories/${encodeURIComponent(id)}`, categoryRecord, "PATCH", fields),
  deleteCategory,
  listProducts: (filters: ProductFilters, signal?: AbortSignal) =>
    request(withQuery("/products/manage", filters), pageResult(productSchema), {
      signal: signal ?? null,
    }),
  createProduct: (fields: ProductFields) => write("/products", productSchema, "POST", fields),
  updateProduct: (id: string, fields: Partial<Omit<ProductFields, "stock_quantity">>) =>
    write(productPath(id), productSchema, "PATCH", fields),
  archiveProduct: (id: string) => write(productPath(id), productSchema, "DELETE"),
  adjustStock: (id: string, adjustment: number) =>
    write(`${productPath(id)}/stock`, productSchema, "PATCH", { adjustment }),
};
