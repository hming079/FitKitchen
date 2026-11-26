import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PromotionManager } from "@/components/admin/promotion-manager";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("loads persisted discount codes instead of displaying preview rows", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        success: true,
        data: [
          {
            id: "12",
            code: "SAVE10",
            description: null,
            discount_type: "PERCENTAGE",
            discount_value: "10",
            min_order_amount: "50000",
            max_discount_amount: "20000",
            start_date: null,
            end_date: null,
            usage_limit: 100,
            per_user_limit: 1,
            is_active: true,
            created_at: "2026-11-26T00:00:00.000Z",
            updated_at: "2026-11-26T00:00:00.000Z",
            redemption_count: 7,
          },
        ],
        pagination: { page: 1, page_size: 50, total: 1 },
      }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PromotionManager />
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("button", { name: "SAVE10" })).toBeInTheDocument();
  expect(screen.getByText("7 / 100")).toBeInTheDocument();
  expect(screen.queryByText("WELCOME15")).not.toBeInTheDocument();
});
