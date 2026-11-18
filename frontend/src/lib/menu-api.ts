import type { z } from "zod";
import {
  categorySchema,
  mealSchema,
  optionSchema,
  pageResult,
  result,
  withQuery,
  type GoalType,
} from "@/lib/catalog-api";

export type NutritionFilters = {
  min_calories?: number | undefined;
  max_calories?: number | undefined;
  min_protein?: number | undefined;
  max_protein?: number | undefined;
};
type MenuFilters = NutritionFilters & { search?: string; goal_type?: GoalType | undefined };

export class MenuApiError extends Error {
  constructor(readonly status: number) {
    super("Could not load the menu.");
  }

  get unavailable() {
    return this.status === 0 || this.status >= 500;
  }
}

async function read<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  const base = (import.meta.env["VITE_API_BASE_URL"] || "").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, { credentials: "omit", signal: signal ?? null });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new MenuApiError(0);
  }
  if (!response.ok) throw new MenuApiError(response.status);

  const body: unknown = await response.json().catch((error: unknown) => {
    if (signal?.aborted) throw error;
    return null;
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new MenuApiError(response.status);
  return parsed.data;
}

const mealPage = pageResult(mealSchema);
const mealResult = result(mealSchema);
const optionsResult = result(optionSchema.array());
const categoriesResult = result(categorySchema.array());
const mealPath = (id: string) => `/meals/${encodeURIComponent(id)}`;

export const menuApi = {
  listMeals: (filters: MenuFilters, page: number, signal?: AbortSignal) =>
    read(withQuery("/meals", { ...filters, page, page_size: 12 }), mealPage, signal),
  getMeal: (id: string, signal?: AbortSignal) => read(mealPath(id), mealResult, signal),
  listOptions: (id: string, signal?: AbortSignal) =>
    read(`${mealPath(id)}/customizations`, optionsResult, signal),
  listCategories: (signal?: AbortSignal) => read("/meal-categories", categoriesResult, signal),
};
