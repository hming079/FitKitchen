import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { browserNavigation, VNPAY_ORIGIN } from "@/lib/order-api";
import { PaymentResult, POLL_INTERVAL_MS, POLL_LIMIT_MS, Route } from "@/routes/payment.result";

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

let responses: Array<() => Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const statusCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/payments/orders/6").length;

function mockFetch(...queue: Array<() => Response>) {
  responses = queue;
  fetchMock = vi.fn(async (input: string) => {
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

function renderResult(orderId: string | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PaymentResult orderId={orderId} />
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
  it("keeps only a valid order_id and ignores VNPay's result value", () => {
    const validate = Route.options.validateSearch as (search: Record<string, unknown>) => unknown;
    expect(validate({ order_id: 6, result: "success" })).toEqual({ order_id: 6 });
    expect(validate({ order_id: "6" })).toEqual({ order_id: 6 });
    for (const order_id of ["abc", 0, -1, 1.5, "1e3", Number.MAX_SAFE_INTEGER + 2]) {
      expect(validate({ order_id, result: "success" })).toEqual({ order_id: undefined });
    }
  });
});

describe("PaymentResult", () => {
  it("shows a confirmed payment from the backend", async () => {
    mockFetch(() => Response.json(status("PAID")));
    renderResult("6");
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/65\.000/);
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

  it("shows a failed payment even when VNPay's query said success, and retries safely", async () => {
    mockFetch(() => Response.json(status("FAILED")));
    const assign = vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
    renderResult("6");
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
