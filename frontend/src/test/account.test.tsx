import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/admin-api";
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

const accountLinks = [
  ["Orders", "/account/orders"],
  ["My plans", "/account/plans"],
  ["Fuel tracker", "/account/tracker"],
] as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function mockSession(signedIn: boolean) {
  if (signedIn) setAccessToken("customer-token");

  const fetch = vi.fn((url: string) => {
    switch (new URL(url, "http://localhost").pathname) {
      case "/api/session":
        return signedIn
          ? Response.json({
              success: true,
              data: { id: "4", full_name: "Jamie Lee", role: "CUSTOMER", is_locked: false },
            })
          : Response.json(
              { code: "UNAUTHORIZED", message: "Sign in to continue." },
              { status: 401 },
            );
      case "/api/orders":
        return Response.json({
          success: true,
          data: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
        });
      case "/api/subscriptions/me":
        return Response.json({ success: true, data: [] });
      default:
        throw new Error(`Unexpected request to ${url}`);
    }
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function show(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient: new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } }) },
  });
  render(<RouterProvider router={router} />);
  return history;
}

it.each([
  ["/account", "/account/orders", "Your orders"],
  ["/dashboard", "/account/plans", "Your meal subscriptions"],
])("replaces %s with %s", async (from, to, heading) => {
  mockSession(true);
  const history = show(from);
  expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  expect(history.location.pathname).toBe(to);
  expect(history.canGoBack()).toBe(false);
});

it.each(accountLinks)("marks %s current in the Account navigation", async (label, path) => {
  mockSession(true);
  show(path);
  expect(await screen.findByText("Hi, Jamie Lee")).toBeVisible();
  const nav = within(screen.getByRole("navigation", { name: "Account" }));
  expect(nav.getAllByRole("link")).toHaveLength(3);
  for (const [name, href] of accountLinks) {
    const link = nav.getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    expect(link.getAttribute("aria-current")).toBe(name === label ? "page" : null);
  }
  const header = within(screen.getByRole("navigation", { name: "Main navigation" }));
  expect(header.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
  expect(header.getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "location");
});

it.each(accountLinks)("requires sign in for %s", async (_label, path) => {
  const fetch = mockSession(false);
  show(path);
  expect(await screen.findByRole("heading", { name: "Sign in required" })).toBeVisible();
  expect(screen.queryByRole("navigation", { name: "Account" })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("labels the tracker as sample data and links to plans and the menu", async () => {
  mockSession(true);
  show("/account/tracker");
  expect(await screen.findByText(/Sample data/)).toBeVisible();
  expect(screen.getByText(/Sample progress for preview/)).toBeVisible();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Advanced analytics" }), { button: 0 });
  expect(await screen.findByRole("link", { name: "Explore FitFuel Plus" })).toHaveAttribute(
    "href",
    "/plans",
  );
  expect(screen.getByRole("link", { name: "Find your next meal" })).toHaveAttribute(
    "href",
    "/menu",
  );
});
