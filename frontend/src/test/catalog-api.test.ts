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
const json = (body: unknown) => new Response(JSON.stringify(body));

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
