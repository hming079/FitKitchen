import { afterEach, expect, it, vi } from "vitest";
import { catalogApi } from "@/lib/catalog-api";

const meal = {
  id: "9223372036854775806",
  category_id: "9007199254740993",
  name: "Meal",
  description: null,
  image_url: null,
  price: "95000.00",
  calories: "450.50",
  protein_g: "42.00",
  carbs_g: "25.25",
  fat_g: "0.00",
  meal_type: "SINGLE",
  goal_type: "CUT",
  allergen_info: "Milk",
  is_available: false,
};
const page = (data: unknown[]) => ({
  success: true,
  data,
  pagination: { page: 2, page_size: 20, total: 21, total_pages: 2 },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

it("decodes NUMERIC strings while preserving bigint identifiers, zero and false", async () => {
  const fetch = vi.fn(async () => json(page([meal])));
  vi.stubGlobal("fetch", fetch);
  const result = await catalogApi.listMeals({
    page: 2,
    category_id: meal.category_id,
    meal_type: "SINGLE",
    goal_type: "CUT",
    available: "false",
    search: "Chicken & rice",
    sort: "price_desc",
  });
  expect(result.data[0]).toEqual({
    ...meal,
    price: 95000,
    calories: 450.5,
    protein_g: 42,
    carbs_g: 25.25,
    fat_g: 0,
  });
  expect(result.pagination.total).toBe(21);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(
      "/meals/manage?page=2&category_id=9007199254740993&meal_type=SINGLE&goal_type=CUT&available=false&search=Chicken+%26+rice&sort=price_desc",
    ),
    expect.anything(),
  );
});

it("decodes option prices, signed macro adjustments and product prices from the API", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/customizations/")
        ? json({
            success: true,
            data: [
              {
                id: "1",
                meal_id: meal.id,
                name: "Smaller portion",
                description: null,
                price_adjustment: "-5000.25",
                calories_adjustment: "-80.25",
                protein_g_adjustment: "16.00",
                carbs_g_adjustment: "0.00",
                fat_g_adjustment: "-2.50",
                is_available: true,
              },
            ],
          })
        : json(
            page([
              {
                id: "2",
                name: "Water",
                description: null,
                category: null,
                image_url: null,
                price: "10000.00",
                stock_quantity: 0,
                unit: "bottle",
                is_available: true,
              },
            ]),
          ),
    ),
  );
  expect((await catalogApi.listOptions(meal.id)).data[0]).toMatchObject({
    price_adjustment: -5000.25,
    calories_adjustment: -80.25,
    protein_g_adjustment: 16,
    carbs_g_adjustment: 0,
    fat_g_adjustment: -2.5,
  });
  expect((await catalogApi.listProducts({})).data[0]).toMatchObject({
    price: 10000,
    stock_quantity: 0,
  });
});

it("rejects malformed numeric strings instead of displaying zero", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json(page([{ ...meal, price: "" }]))),
  );
  await expect(catalogApi.listMeals({})).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});

it("preserves specific validation issues and resource not-found messages", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          errors: ["price must be a non-negative number"],
        },
        400,
      ),
    )
    .mockResolvedValueOnce(json({ code: "NOT_FOUND", message: "Category not found" }, 404));
  vi.stubGlobal("fetch", fetch);
  await expect(catalogApi.updateMeal(meal.id, { price: -1 })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "price must be a non-negative number",
  });
  await expect(catalogApi.updateCategory("2", { name: "New name" })).rejects.toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Category not found",
  });
});
