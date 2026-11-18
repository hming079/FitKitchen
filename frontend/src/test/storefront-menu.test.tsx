import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

vi.mock("@/routes/__root", async () => {
  const { createRootRouteWithContext, Outlet } = await import("@tanstack/react-router");
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <QueryClientProvider client={root.useRouteContext().queryClient}>
        <Outlet />
      </QueryClientProvider>
    ),
  });
  return { Route: root };
});

const meal = {
  id: "9007199254740993",
  category_id: "2",
  name: "Grilled chicken",
  description: "Served with brown rice.",
  image_url: "/images/chicken.jpg",
  price: "65000.00",
  calories: "450.00",
  protein_g: "40.00",
  carbs_g: "45.00",
  fat_g: "10.00",
  meal_type: "SINGLE",
  goal_type: "CUT",
  allergen_info: "Milk",
  is_available: true,
};

const extraChicken = {
  id: "1",
  meal_id: meal.id,
  name: "Extra grilled chicken",
  description: "Add 50 g.",
  price_adjustment: "20000.00",
  calories_adjustment: "80.00",
  protein_g_adjustment: "16.00",
  carbs_g_adjustment: "2.50",
  fat_g_adjustment: "-1.50",
  is_available: true,
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const result = (data: unknown) => json({ success: true, data });
const page = (data: unknown[], number = 1, totalPages = 1) =>
  json({
    success: true,
    data,
    pagination: {
      page: number,
      page_size: 12,
      total: totalPages === 2 ? 13 : data.length,
      total_pages: totalPages,
    },
  });

const vnd = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFetch(handle: (url: URL) => Response | Promise<Response>) {
  const fetch = vi.fn((path: string, _options: RequestInit) =>
    Promise.resolve(handle(new URL(path, "http://localhost"))),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function show(path = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } }) },
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

function menu() {
  return within(screen.getByRole("region", { name: "On the menu" }));
}

it("renders public meals, formats nutrition and VND, and falls back for a broken photo", async () => {
  const fetch = mockFetch(() => page([meal]));
  await show();
  const card = within(await menu().findByRole("article"));
  expect(card.getByRole("heading", { name: meal.name })).toBeVisible();
  expect(card.getByText(vnd(65000), { normalizer: (text) => text })).toBeVisible();
  for (const text of ["450 kcal", "40 g", "45 g", "10 g", "Cut"]) {
    expect(card.getByText(text, { exact: true })).toBeVisible();
  }
  expect(card.getByRole("link", { name: `View meal details for ${meal.name}` })).toHaveAttribute(
    "href",
    `/meal/${meal.id}`,
  );
  fireEvent.error(card.getByRole("img", { name: meal.name }));
  expect(card.getByText("Photo unavailable")).toBeVisible();
  expect(menu().queryByText(/sample previews/i)).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/meals\?.*page=1&page_size=12/),
    expect.objectContaining({ credentials: "omit", signal: expect.any(AbortSignal) }),
  );
});

it("sends goal and nutrition ranges, debounces search, and clears filters after an empty result", async () => {
  const fetch = mockFetch((url) =>
    url.searchParams.get("search") ? page([], 1, 0) : page([meal]),
  );
  const requests = () =>
    fetch.mock.calls.map(([path]) => new URL(path, "http://localhost").searchParams);
  await show();
  await menu().findByRole("article");
  expect(menu().getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(menu().getByRole("button", { name: "Cut" }));
  await waitFor(() => expect(requests().at(-1)?.get("goal_type")).toBe("CUT"));
  const minimumCalories = menu().getByRole("spinbutton", { name: "Min calories" });
  const maximumCalories = menu().getByRole("spinbutton", { name: "Max calories" });
  fireEvent.change(minimumCalories, { target: { value: "600" } });
  fireEvent.change(maximumCalories, { target: { value: "500" } });
  fireEvent.click(menu().getByRole("button", { name: "Apply ranges" }));
  expect(menu().getByRole("alert")).toHaveTextContent(
    "Maximum calories must be at least the minimum.",
  );
  expect(minimumCalories).toBeInvalid();
  expect(requests().some((query) => query.has("min_calories"))).toBe(false);
  const ranges = {
    "Min calories": "400",
    "Max calories": "500",
    "Min protein": "0",
    "Max protein": "45.5",
  };
  for (const [label, value] of Object.entries(ranges)) {
    fireEvent.change(menu().getByRole("spinbutton", { name: label }), { target: { value } });
  }
  fireEvent.click(menu().getByRole("button", { name: "Apply ranges" }));
  await waitFor(() =>
    expect(Object.fromEntries(requests().at(-1) ?? [])).toMatchObject({
      goal_type: "CUT",
      min_calories: "400",
      max_calories: "500",
      min_protein: "0",
      max_protein: "45.5",
      page: "1",
    }),
  );
  const search = menu().getByRole("searchbox", { name: "Search meals" });
  fireEvent.change(search, { target: { value: "Sa" } });
  fireEvent.change(search, { target: { value: " Salmon & rice " } });
  expect(requests().some((query) => query.get("search"))).toBe(false);
  expect(await menu().findByText("No meals match your filters.")).toBeVisible();
  expect(requests().at(-1)?.get("search")).toBe("Salmon & rice");
  expect(requests().some((query) => query.get("search") === "Sa")).toBe(false);
  expect(menu().queryByText(/sample previews/i)).toBeNull();
  fireEvent.click(menu().getByRole("button", { name: "Clear filters" }));
  await menu().findByRole("article");
  expect(search).toHaveValue("");
  expect(menu().getByRole("spinbutton", { name: "Max calories" })).toHaveValue(null);
  expect(menu().getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
});

it("retains earlier pages on a next-page error and appends records when retried", async () => {
  let nextAttempts = 0;
  const fetch = mockFetch((url) => {
    if (url.searchParams.get("page") !== "2") return page([meal], 1, 2);
    if (++nextAttempts === 1) return json({}, 503);
    return page([{ ...meal, id: "5", name: "Salmon bowl" }], 2, 2);
  });
  await show();
  const button = await menu().findByRole("button", { name: "Load more" });
  fireEvent.click(button);
  expect(await menu().findByRole("alert")).toHaveTextContent("Could not load more meals.");
  expect(menu().getByRole("heading", { name: meal.name })).toBeVisible();
  expect(menu().queryByText(/sample previews/i)).toBeNull();
  fireEvent.click(button);
  expect(await menu().findByRole("heading", { name: "Salmon bowl" })).toBeVisible();
  expect(menu().getAllByRole("article")).toHaveLength(2);
  expect(menu().queryByRole("button", { name: "Load more" })).toBeNull();
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringContaining("page=2&page_size=12"),
    expect.anything(),
  );
});

it("shows clearly labelled sample previews on network failure and live meals after retry", async () => {
  let online = false;
  mockFetch(() => {
    if (!online) return Promise.reject(new TypeError("Failed to fetch"));
    return page([meal]);
  });
  await show();
  expect(await menu().findByRole("alert")).toHaveTextContent(/sample previews/i);
  expect(
    menu().getByRole("heading", { name: "Teriyaki Chicken Breast & Brown Rice" }),
  ).toBeVisible();
  online = true;
  fireEvent.click(menu().getByRole("button", { name: "Try again" }));
  expect(await menu().findByRole("heading", { name: meal.name })).toBeVisible();
  expect(menu().queryByText(/sample previews/i)).toBeNull();
  expect(menu().getAllByRole("article")).toHaveLength(1);
});

it("shows a rejected request without displaying sample previews", async () => {
  mockFetch(() => json({}, 400));
  await show();
  expect(await menu().findByRole("alert")).toHaveTextContent("Could not load meals.");
  expect(menu().queryByRole("article")).toBeNull();
});

it("shows meal details and compares original with adjusted price and all four macros", async () => {
  const fetch = mockFetch(({ pathname }) => {
    if (pathname === "/api/meal-categories")
      return result([
        { id: "2", name: "Eat Clean", description: null, meal_count: 1, total_meal_count: 1 },
      ]);
    if (pathname.endsWith("/customizations"))
      return result([
        extraChicken,
        { ...extraChicken, id: "9", name: "Paused option", is_available: false },
      ]);
    return result(meal);
  });
  await show(`/meal/${meal.id}`);
  expect(await screen.findByRole("heading", { name: meal.name })).toBeVisible();
  expect(await screen.findByText("Eat Clean")).toBeVisible();
  expect(screen.getByRole("note")).toHaveTextContent("Milk");
  const option = await screen.findByRole("checkbox", { name: extraChicken.name });
  expect(screen.queryByRole("checkbox", { name: "Paused option" })).toBeNull();
  const table = within(screen.getByRole("table", { name: "Price and nutrition" }));
  function compare(label: string, original: string, customized: string) {
    const row = table.getByRole("rowheader", { name: label }).closest("tr");
    if (!row) throw new Error(`Missing row for ${label}`);
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([original, customized]);
  }
  compare("Price", vnd(65000), vnd(65000));
  fireEvent.click(option);
  expect(option).toBeChecked();
  compare("Price", vnd(65000), vnd(85000));
  compare("Calories", "450 kcal", "530 kcal");
  compare("Protein", "40 g", "56 g");
  compare("Carbs", "45 g", "47.5 g");
  compare("Fat", "10 g", "8.5 g");
  expect(screen.getByRole("button", { name: "Online ordering opens soon" })).toBeDisabled();
  fireEvent.click(option);
  compare("Price", vnd(65000), vnd(65000));
  expect(fetch.mock.calls.every(([path]) => path.includes("/api/"))).toBe(true);
});

it("floors customized prices and all four macros at zero", async () => {
  const smaller = {
    ...extraChicken,
    name: "Smaller portion",
    price_adjustment: "-66000.00",
    calories_adjustment: "-500.00",
    protein_g_adjustment: "-41.00",
    carbs_g_adjustment: "-46.00",
    fat_g_adjustment: "-11.00",
  };
  mockFetch(({ pathname }) =>
    pathname.endsWith("/customizations")
      ? result([smaller])
      : result({ ...meal, category_id: null }),
  );
  await show(`/meal/${meal.id}`);
  fireEvent.click(await screen.findByRole("checkbox", { name: smaller.name }));
  const status = screen.getByText(/Customized per meal\./);
  expect(status.textContent).toBe(
    `Customized per meal. Price ${vnd(0)}, Calories 0 kcal, Protein 0 g, Carbs 0 g, Fat 0 g`,
  );
  const rows = within(screen.getByRole("table", { name: "Price and nutrition" })).getAllByRole(
    "row",
  );
  expect(rows.slice(1).map((row) => within(row).getAllByRole("cell").at(-1)?.textContent)).toEqual([
    vnd(0),
    "0 kcal",
    "0 g",
    "0 g",
    "0 g",
  ]);
});

it("marks a paused meal unavailable and does not fetch options for it", async () => {
  const fetch = mockFetch(() => result({ ...meal, category_id: null, is_available: false }));
  await show(`/meal/${meal.id}`);
  expect(await screen.findByText("Currently unavailable")).toBeVisible();
  expect(screen.getByRole("button", { name: "Online ordering opens soon" })).toBeDisabled();
  expect(fetch).toHaveBeenCalledOnce();
});

it("shows meal not found for a nonnumeric route without calling the API", async () => {
  const fetch = mockFetch(() => json({}, 400));
  await show("/meal/abc");
  expect(await screen.findByRole("heading", { name: "Meal not found." })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([400, 404])(
  "offers a link back to the menu when the meal API returns %i",
  async (status) => {
    mockFetch(() => json({}, status));
    await show("/meal/999");
    expect(await screen.findByRole("heading", { name: "Meal not found." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the menu" })).toHaveAttribute(
      "href",
      "/#menu",
    );
  },
);
