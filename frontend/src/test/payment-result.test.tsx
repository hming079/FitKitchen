import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { browserNavigation, VNPAY_ORIGIN } from "@/lib/order-api";
import {
  PaymentResult,
  POLL_INTERVAL_MS,
  POLL_LIMIT_MS,
  Route,
  type VnpayResultHint,
} from "@/routes/payment.result";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

const VNPAY_URL = `${VNPAY_ORIGIN}/paymentv2/vpcpay.html?vnp_TxnRef=6A3T20261126020000`;

function status(payment_status: string, extra: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      order_id: "6",
      order_status: "PENDING",
      payment_method: "ONLINE",
      payment_status,
      total_amount: "65000.00",
      can_retry: payment_status !== "PAID",
      latest_transaction: null,
      ...extra,
    },
  };
}

const orderDetails = {
  success: true,
  data: {
    id: "6",
    created_at: "2026-11-25T18:00:00.000Z",
    delivery_date: "2026-11-27",
    total_amount: "65000.00",
    shipping_fee: "0.00",
    status: "PENDING",
    payment_method: "ONLINE",
    payment_status: "PAID",
    delivery_time_slot: "11:00 - 12:00",
    items: [
      {
        id: "11",
        meal_id: "1",
        name: "Grilled chicken with asparagus",
        quantity: 1,
        unit_price: "65000.00",
        options: [],
      },
    ],
  },
};

let responses: Array<() => Response>;
let fetchMock: ReturnType<typeof vi.fn>;
let orderResponse: () => Response;
const statusCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/payments/orders/6").length;

function mockFetch(...queue: Array<() => Response>) {
  responses = queue;
  orderResponse = () => Response.json(orderDetails);
  fetchMock = vi.fn(async (input: string) => {
    if (input === "/api/orders/6") return orderResponse();
    if (input === "/api/payments/vnpay")
      return Response.json({
        success: true,
        data: {
          provider: "VNPAY",
          order_id: "6",
          txn_ref: "6A3T20261126020000",
          expires_at: "2026-11-25T19:15:00.000Z",
          redirect_url: VNPAY_URL,
        },
      });
    const next = responses.length > 1 ? responses.shift()! : responses[0]!;
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
}

function renderResult(orderId: string | undefined, vnpayResult?: VnpayResultHint) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PaymentResult orderId={orderId} vnpayResult={vnpayResult} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.setItem(ACCESS_TOKEN_KEY, "test-token");
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("payment result search", () => {
  it("keeps a valid order_id and VNPay's result only as a known hint", () => {
    const validate = Route.options.validateSearch as (search: Record<string, unknown>) => unknown;
    expect(validate({ order_id: 6, result: "success" })).toEqual({
      order_id: 6,
      result: "success",
    });
    expect(validate({ order_id: "6" })).toEqual({ order_id: 6, result: undefined });
    for (const result of ["failed", "invalid"])
      expect(validate({ order_id: 6, result })).toEqual({ order_id: 6, result });
    for (const result of ["paid", "", 1, "SUCCESS"])
      expect(validate({ order_id: 6, result })).toEqual({ order_id: 6, result: undefined });
    for (const order_id of ["abc", 0, -1, 1.5, "1e3", Number.MAX_SAFE_INTEGER + 2]) {
      expect(validate({ order_id, result: "success" })).toEqual({
        order_id: undefined,
        result: "success",
      });
    }
  });
});

describe("PaymentResult", () => {
  it("shows a confirmed payment, the next steps and the order summary", async () => {
    mockFetch(() => Response.json(status("PAID")));
    renderResult("6");
    const confirmation = (await screen.findByText("Payment received")).closest("[role=status]");
    expect(confirmation).toHaveTextContent(/65\.000/);
    // /dashboard now redirects to /account/plans; orders live at /account/orders.
    expect(screen.getByRole("link", { name: "View your orders" })).toHaveAttribute(
      "href",
      "/account/orders",
    );
    expect(confirmation).toHaveTextContent(
      /kitchen confirms your order, then it goes out for delivery/,
    );

    const summary = await screen.findByRole("region", { name: "Order summary" });
    expect(
      await within(summary).findByText(/Grilled chicken with asparagus × 1/),
    ).toBeInTheDocument();
    expect(within(summary).getByText("11:00 - 12:00")).toBeInTheDocument();
    expect(within(summary).getByText("VNPay")).toBeInTheDocument();
    expect(within(summary).getByText("Paid")).toBeInTheDocument();
    expect(within(summary).getByText("Total").nextSibling).toHaveTextContent(/65\.000/);
  });

  it("keeps the payment state visible when the order summary fails to load", async () => {
    mockFetch(() => Response.json(status("FAILED")));
    orderResponse = () => {
      throw new TypeError("Failed to fetch");
    };
    renderResult("6");
    expect(await screen.findByText("Payment was not completed")).toBeInTheDocument();
    expect(await screen.findByText(/order summary could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try payment again" })).toBeEnabled();

    orderResponse = () => Response.json(orderDetails);
    fireEvent.click(screen.getByRole("button", { name: "Reload summary" }));
    expect(await screen.findByText(/Grilled chicken with asparagus × 1/)).toBeInTheDocument();
  });

  it("waits for VNPay, polls every 3 seconds and shows the confirmation", async () => {
    mockFetch(
      () => Response.json(status("PENDING")),
      () => Response.json(status("PENDING")),
      () => Response.json(status("PAID")),
    );
    renderResult("6");
    expect(await screen.findByText(/waiting for vnpay to confirm/i)).toBeInTheDocument();
    expect(statusCalls()).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(statusCalls()).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(statusCalls()).toBe(3);
    expect(await screen.findByText("Payment received")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(statusCalls()).toBe(3);
  });

  it("stops polling after about a minute and lets the customer check again", async () => {
    mockFetch(() => Response.json(status("PENDING")));
    renderResult("6");
    await screen.findByText(/waiting for vnpay to confirm/i);

    await act(() => vi.advanceTimersByTimeAsync(POLL_LIMIT_MS + POLL_INTERVAL_MS));
    const calls = statusCalls();
    expect(calls).toBeLessThanOrEqual(POLL_LIMIT_MS / POLL_INTERVAL_MS + 2);
    expect(await screen.findByText(/has not confirmed this payment yet/i)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5));
    expect(statusCalls()).toBe(calls);

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(statusCalls()).toBe(calls + 1);
  });

  it("keeps polling when VNPay says success but the backend is still PENDING", async () => {
    mockFetch(() => Response.json(status("PENDING")));
    renderResult("6", "success");
    expect(await screen.findByText(/waiting for vnpay to confirm/i)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(statusCalls()).toBe(2);
  });

  for (const hint of ["failed", "invalid"] as const) {
    it(`does not poll when VNPay returned ${hint} and the backend is still PENDING`, async () => {
      mockFetch(
        () => Response.json(status("PENDING")),
        () => Response.json(status("PAID")),
      );
      const assign = vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
      renderResult("6", hint);
      expect(await screen.findByText("Payment wasn’t completed on VNPay")).toBeInTheDocument();
      expect(
        screen.getByText("If you did pay, confirmation may still arrive."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/waiting for vnpay to confirm/i)).not.toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5));
      expect(statusCalls()).toBe(1);

      fireEvent.click(screen.getByRole("button", { name: "Try payment again" }));
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(assign).toHaveBeenCalledWith(VNPAY_URL);

      // The server stays authoritative: a later check showing PAID wins over the hint.
      fireEvent.click(screen.getByRole("button", { name: "Check again" }));
      expect(await screen.findByText("Payment received")).toBeInTheDocument();
      expect(statusCalls()).toBe(2);
    });
  }

  it("hides the retry for a returned-unpaid order the backend will not let you pay", async () => {
    mockFetch(() => Response.json(status("PENDING", { can_retry: false })));
    renderResult("6", "failed");
    await screen.findByText("Payment wasn’t completed on VNPay");
    expect(screen.queryByRole("button", { name: "Try payment again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
  });

  it("shows a failed payment even when VNPay's query said success, and retries safely", async () => {
    mockFetch(() => Response.json(status("FAILED")));
    const assign = vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
    renderResult("6", "success");
    expect(await screen.findByText("Payment was not completed")).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Try payment again" });
    fireEvent.click(retry);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(assign).toHaveBeenCalledWith(VNPAY_URL);
    expect(screen.getByRole("button", { name: "Opening VNPay…" })).toBeDisabled();
  });

  it("hides the retry when the backend does not allow another payment", async () => {
    mockFetch(() => Response.json(status("FAILED", { can_retry: false })));
    renderResult("6");
    await screen.findByText("Payment was not completed");
    expect(screen.queryByRole("button", { name: "Try payment again" })).not.toBeInTheDocument();
  });

  it("asks the customer to sign in without a session or after 401", async () => {
    sessionStorage.clear();
    mockFetch(() => Response.json(status("PAID")));
    const { unmount } = renderResult("6");
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();

    sessionStorage.setItem(ACCESS_TOKEN_KEY, "expired");
    mockFetch(() =>
      Response.json(
        { success: false, code: "UNAUTHENTICATED", message: "Session expired" },
        { status: 401 },
      ),
    );
    renderResult("6");
    expect(await screen.findByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("reports a network error and retries the status check", async () => {
    mockFetch(
      () => {
        throw new TypeError("Failed to fetch");
      },
      () => Response.json(status("PAID")),
    );
    renderResult("6");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not check your payment/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
  });

  it("explains a missing order id and an order from another account", async () => {
    mockFetch(() =>
      Response.json(
        { success: false, code: "ORDER_NOT_FOUND", message: "Order not found" },
        { status: 404 },
      ),
    );
    const { unmount } = renderResult(undefined);
    expect(screen.getByText(/does not include an order/i)).toBeInTheDocument();
    unmount();

    renderResult("6");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not found in your account/i);
  });
});
