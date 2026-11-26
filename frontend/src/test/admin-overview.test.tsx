import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminOverview } from "@/components/admin/admin-overview";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("shows the paid-customer renewal rate and exposes the previous month report", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        success: true,
        data: {
          daily_revenue: "0",
          previous_daily_revenue: "0",
          period_revenue: "0",
          average_order_value: null,
          pending_orders: 0,
          deliveries_today: 0,
          active_subscriptions: 0,
          renewal_eligible_customers: 4,
          renewed_customers: 1,
          renewal_rate: "25.0",
          top_meal: null,
          revenue_series: [{ date: "2026-10-01", revenue: "0" }],
          recent_orders: [],
        },
      }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminOverview onOrders={vi.fn()} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("25.0%")).toBeInTheDocument();
  expect(screen.getByText("1 of 4 ended customers · new paid plan within 7 days")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Sales period" }));
  expect(screen.getByRole("option", { name: "Last month" })).toBeInTheDocument();
});
