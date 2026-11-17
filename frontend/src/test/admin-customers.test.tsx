import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CustomerStatusDialog } from "@/components/admin/customer-status-dialog";
import { CustomerDetails } from "@/components/admin/customer-details";
import type { Customer } from "@/lib/admin-api";

const customer: Customer = {
  id: "21",
  full_name: "Fixture customer",
  email: "fixture@example.test",
  phone: null,
  fitness_goal: "CUT",
  role: "CUSTOMER",
  is_locked: false,
  created_at: null,
};
const profile = { success: true, data: { ...customer, addresses: [], unfinished_order_count: 0 } };
const empty = { success: true, data: [], pagination: { page: 1, page_size: 10, total: 0 } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
// jsdom has no layout observer; Radix Checkbox uses it to size its hidden input.
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
function show(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

it.each(["UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles"])(
  "keeps delivery and plan calendar dates unchanged in %s",
  async (timezone) => {
    vi.stubEnv("TZ", timezone);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/orders"))
          return json({
            ...empty,
            data: [
              {
                id: "1",
                created_at: null,
                delivery_date: "2026-11-18",
                total_amount: "0",
                status: "PENDING",
                payment_method: "COD",
                payment_status: "PENDING",
              },
            ],
          });
        if (url.includes("/subscriptions"))
          return json({
            ...empty,
            data: [
              {
                id: "2",
                plan_name: "Calendar fixture",
                start_date: "2026-11-16",
                end_date: "2026-12-15",
                total_amount: "0",
                status: "ACTIVE",
                payment_method: "ONLINE",
                payment_status: "PAID",
              },
            ],
          });
        return json(profile);
      }),
    );
    show(<CustomerDetails customer={customer} onClose={vi.fn()} />);
    expect(
      await screen.findByText("Ordered Not recorded · Delivery 18/11/2026"),
    ).toBeInTheDocument();
    expect(await screen.findByText("16/11/2026 – 15/12/2026")).toBeInTheDocument();
  },
);

it("returns keyboard focus to the customer action when the profile closes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      json(url.includes("/orders") || url.includes("/subscriptions") ? empty : profile),
    ),
  );
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>View fixture</button>
        {open && <CustomerDetails customer={customer} onClose={() => setOpen(false)} />}
      </>
    );
  }
  show(<Harness />);
  const opener = screen.getByRole("button", { name: "View fixture" });
  opener.focus();
  fireEvent.click(opener);
  await screen.findByText("No addresses.");
  fireEvent.click(screen.getByRole("button", { name: "Close profile" }));
  await waitFor(() => expect(opener).toHaveFocus());
});

it("requires review of server-reported unfinished orders before resubmitting a lock", async () => {
  let patches = 0;
  const success = vi.fn();
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method !== "PATCH") return json(profile);
    patches++;
    if (patches === 1)
      return json(
        {
          code: "UNFINISHED_ORDERS",
          message: "New unfinished orders require confirmation",
          unfinished_order_count: 2,
        },
        409,
      );
    expect(JSON.parse(String(options.body))).toEqual({
      is_locked: true,
      reason: "Support review",
      confirm_unfinished_orders: true,
    });
    return json({ success: true, data: { ...customer, is_locked: true }, changed: true });
  });
  vi.stubGlobal("fetch", fetch);
  show(<CustomerStatusDialog customer={customer} onClose={vi.fn()} onSuccess={success} />);
  const submit = screen.getByRole("button", { name: "Lock account" });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason (required)"), {
    target: { value: " Support review " },
  });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  await screen.findByText(/2 unfinished orders need attention/);
  expect(submit).toBeDisabled();
  expect(success).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(submit);
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(patches).toBe(2);
});

it("shows independent profile/order/plan states and can retry a failed history section", async () => {
  let orderRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/orders")) {
        orderRequests++;
        return orderRequests === 1
          ? json({ code: "INTERNAL_ERROR", message: "Could not load orders" }, 500)
          : json(empty);
      }
      if (url.includes("/subscriptions")) return json(empty);
      return json(profile);
    }),
  );
  show(<CustomerDetails customer={customer} onClose={vi.fn()} />);
  await screen.findByText("No addresses.");
  await screen.findByText("No current service plans.");
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("Could not load orders");
  fireEvent.click(within(error.parentElement!).getByRole("button", { name: "Try again" }));
  await screen.findByText("No orders.");
  expect(orderRequests).toBe(2);
});
