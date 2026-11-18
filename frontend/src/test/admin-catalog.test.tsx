import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogManager } from "@/components/admin/catalog/catalog-manager";

const meal = {
  id: "9007199254740993",
  category_id: null,
  name: "Grilled chicken",
  description: null,
  image_url: null,
  price: "95000.00",
  calories: "480.00",
  protein_g: "42.50",
  carbs_g: "0.00",
  fat_g: "0.00",
  meal_type: "SINGLE",
  is_available: true,
};
const category = { id: "2", name: "Chicken", description: null, meal_count: 1 };
const product = {
  id: "3",
  name: "Whey mix",
  description: null,
  category: "Supplements",
  image_url: null,
  price: "100000.00",
  stock_quantity: 2,
  unit: "pack",
  is_available: true,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const result = (data: unknown) => json({ success: true, data });
const list = (data: unknown[]) =>
  json({
    success: true,
    data,
    pagination: { page: 1, page_size: 20, total: data.length, total_pages: data.length ? 1 : 0 },
  });

beforeEach(() => {
  // Radix observes the dimensions of its native form inputs.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function show(write?: (url: string, options: RequestInit) => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: string, options: RequestInit) => {
    if (options.method && options.method !== "GET" && write) return write(url, options);
    if (url.includes("/meal-categories")) return result([category]);
    if (url.includes("/products/manage")) return list([product]);
    if (url.includes("/meals/manage")) return list([meal]);
    throw new Error(`Unexpected request to ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <CatalogManager />
    </QueryClientProvider>,
  );
  return fetch;
}

function selectTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
}

async function fillMeal() {
  const add = screen.getByRole("button", { name: "Add meal" });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(add);
  const dialog = screen.getByRole("dialog", { name: "Add meal" });
  for (const [label, value] of Object.entries({
    "Meal name": " New meal ",
    "Price (VND)": "95000",
    "Calories (kcal)": "480",
    "Protein (g)": "42.5",
    "Carbs (g)": "0",
    "Fat (g)": "0",
  })) {
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  }
  return dialog;
}

it("lists meals from the manage API and formats their prices in VND", async () => {
  show();
  const row = (await screen.findByText(meal.name)).closest("tr");
  expect(row?.textContent).toContain(
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(95000),
  );
  expect(row).toHaveTextContent("480 kcal");
  expect(row).toHaveTextContent("42.5 g");
  expect(row).toHaveTextContent("On sale");
});

it("posts a meal with numeric price, calories and macros and disables submit while saving", async () => {
  let finish: (value: Response) => void = () => undefined;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const write = vi.fn(() => response);
  const fetch = show(write);
  const dialog = await fillMeal();
  const submit = within(dialog).getByRole("button", { name: "Add meal" });
  fireEvent.click(submit);
  await waitFor(() => expect(submit).toBeDisabled());
  expect(write).toHaveBeenCalledOnce();
  const post = fetch.mock.calls.find(([, options]) => options.method === "POST");
  expect(post?.[0]).toMatch(/\/api\/meals$/);
  expect(JSON.parse(String(post?.[1].body))).toEqual({
    name: "New meal",
    category_id: null,
    description: null,
    image_url: null,
    price: 95000,
    calories: 480,
    protein_g: 42.5,
    carbs_g: 0,
    fat_g: 0,
    meal_type: "SINGLE",
    is_available: true,
  });
  finish(result({ ...meal, name: "New meal" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

it("shows a recoverable error when backend validation returns 400 without a code", async () => {
  show(() =>
    json({ success: false, message: "Validation failed", errors: ["name is required"] }, 400),
  );
  const dialog = await fillMeal();
  fireEvent.click(within(dialog).getByRole("button", { name: "Add meal" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Check the fields and try again.",
  );
  expect(within(dialog).getByLabelText("Meal name")).toHaveValue(" New meal ");
});

it("shows the server's count when category deletion is blocked", async () => {
  const write = vi.fn(() =>
    json(
      {
        success: false,
        code: "CATEGORY_IN_USE",
        message: "Category is still referenced by meals",
        meal_count: 3,
      },
      409,
    ),
  );
  show(write);
  selectTab("Categories");
  fireEvent.click(await screen.findByRole("button", { name: "Delete Chicken" }));
  const dialog = screen.getByRole("alertdialog", { name: "Delete category" });
  expect(write).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete category" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "3 meals still use this category. Move them to another category first.",
  );
});

it("places a duplicate category error on the name field", async () => {
  show(() =>
    json(
      { success: false, code: "CATEGORY_NAME_TAKEN", message: "Category name is already in use" },
      409,
    ),
  );
  selectTab("Categories");
  fireEvent.click(screen.getByRole("button", { name: "Add category" }));
  const dialog = screen.getByRole("dialog", { name: "Add category" });
  const name = within(dialog).getByLabelText("Category name");
  fireEvent.change(name, { target: { value: category.name } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add category" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Category name is already in use",
  );
  expect(name).toHaveAccessibleDescription("Category name is already in use");
  expect(name).toBeInvalid();
});

it("sends a signed stock delta and displays insufficient stock without closing the dialog", async () => {
  const write = vi.fn((_url, _options) =>
    json(
      {
        success: false,
        code: "INSUFFICIENT_STOCK",
        message: "Adjustment would make stock negative",
      },
      409,
    ),
  );
  show(write);
  selectTab("Products");
  fireEvent.click(await screen.findByRole("button", { name: "Adjust stock for Whey mix" }));
  const dialog = screen.getByRole("dialog", { name: "Adjust stock" });
  fireEvent.change(within(dialog).getByLabelText("Quantity change"), { target: { value: "-3" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Apply adjustment" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Adjustment would make stock negative",
  );
  expect(write).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/products\/3\/stock$/),
    expect.objectContaining({ method: "PATCH", body: '{"adjustment":-3}' }),
  );
});
