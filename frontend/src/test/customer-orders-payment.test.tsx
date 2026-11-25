import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerOrders } from "@/components/customer-orders";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { browserNavigation, VNPAY_ORIGIN } from "@/lib/order-api";

const VNPAY_URL = `${VNPAY_ORIGIN}/paymentv2/vpcpay.html?vnp_TxnRef=7A1T20261126020000`;

function order(id: string, payment_method: string, payment_status: string, status = "PENDING") {
  return {
    id,
    created_at: "2026-11-25T18:00:00.000Z",
    delivery_date: "2026-11-27",
    total_amount: "65000.00",
    shipping_fee: "0.00",
    status,
    payment_method,
    payment_status,
    delivery_time_slot: null,
    items_summary: "Grilled chicken x1",
  };
}

const orders = [
  order("7", "ONLINE", "FAILED"),
  order("6", "ONLINE", "PAID"),
  order("5", "COD", "PENDING"),
];

function mockApi(paymentResponse: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.startsWith("/api/orders?"))
        return Response.json({
          success: true,
          data: orders,
          pagination: { page: 1, page_size: 20, total: 3 },
        });
      if (input === "/api/orders/6")
        return Response.json({ success: true, data: { ...orders[1], items: [] } });
      if (input === "/api/payments/vnpay") return paymentResponse();
      return Response.json(
        { success: false, code: "NOT_FOUND", message: "Not found" },
        { status: 404 },
      );
    }),
  );
}

function renderOrders() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CustomerOrders />
    </QueryClientProvider>,
  );
}

let assign: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, "test-token");
  assign = vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("customer orders payment", () => {
  it("shows the real payment method and offers Pay now only for unpaid online orders", async () => {
    mockApi(() =>
      Response.json({
        success: true,
        data: {
          provider: "VNPAY",
          order_id: "7",
          txn_ref: "7A1T20261126020000",
          expires_at: "2026-11-25T19:15:00.000Z",
          redirect_url: VNPAY_URL,
        },
      }),
    );
    renderOrders();
    expect(await screen.findByText(/VNPay payment failed/)).toBeInTheDocument();
    expect(screen.getByText(/Paid with VNPay/)).toBeInTheDocument();
    expect(screen.getByText(/Cash on delivery/)).toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: /^Pay now/ })).toHaveLength(1);
    const pay = screen.getByRole("button", { name: "Pay now for order 7" });
    fireEvent.click(pay);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(VNPAY_URL));
    expect(pay).toBeDisabled();
    expect(pay).toHaveTextContent("Opening VNPay…");
  });

  it("does not follow an untrusted URL and reports backend refusals", async () => {
    let call = 0;
    mockApi(() =>
      ++call === 1
        ? Response.json({
            success: true,
            data: {
              provider: "VNPAY",
              order_id: "7",
              txn_ref: "7A1T20261126020000",
              expires_at: "2026-11-25T19:15:00.000Z",
              redirect_url: "https://evil.example/pay",
            },
          })
        : Response.json(
            {
              success: false,
              code: "PAYMENT_NOT_ALLOWED",
              message: "This order cannot be paid online",
            },
            { status: 409 },
          ),
    );
    renderOrders();
    fireEvent.click(await screen.findByRole("button", { name: "Pay now for order 7" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be opened/i);
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pay now for order 7" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This order cannot be paid online");
  });

  it("hides self-cancellation for a paid online order", async () => {
    mockApi(() => Response.json({ success: false }, { status: 500 }));
    renderOrders();
    fireEvent.click(await screen.findByRole("button", { name: "View details for order 6" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Paid with VNPay")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Pay now/ })).not.toBeInTheDocument();
  });
});
