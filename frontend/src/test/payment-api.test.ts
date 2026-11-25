import { afterEach, describe, expect, it, vi } from "vitest";
import { canPayOnline, orderApi, vnpayRedirectUrl, VNPAY_ORIGIN } from "@/lib/order-api";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("vnpayRedirectUrl", () => {
  it("accepts only https URLs on the VNPay Sandbox origin", () => {
    const valid = `${VNPAY_ORIGIN}/paymentv2/vpcpay.html?vnp_Amount=6500000&vnp_TxnRef=6A2T20261126012212`;
    expect(vnpayRedirectUrl(valid)).toBe(valid);
    for (const value of [
      null,
      undefined,
      "",
      "not a url",
      "/paymentv2/vpcpay.html",
      "http://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      "https://sandbox.vnpayment.vn.evil.example/paymentv2/vpcpay.html",
      "https://evil.example/?next=https://sandbox.vnpayment.vn",
      "https://user@evil.example/sandbox.vnpayment.vn",
      "https://sandbox.vnpayment.vn:8443/paymentv2/vpcpay.html",
      "javascript:alert(1)",
    ]) {
      expect(vnpayRedirectUrl(value), String(value)).toBeNull();
    }
  });
});

describe("canPayOnline", () => {
  it("matches the backend rule for creating a payment URL", () => {
    const base = { payment_method: "ONLINE", status: "PENDING", payment_status: "PENDING" };
    expect(canPayOnline(base)).toBe(true);
    expect(canPayOnline({ ...base, payment_status: "FAILED" })).toBe(true);
    expect(canPayOnline({ ...base, payment_status: "PAID" })).toBe(false);
    expect(canPayOnline({ ...base, payment_method: "COD" })).toBe(false);
    expect(canPayOnline({ ...base, status: "CANCELLED" })).toBe(false);
    expect(canPayOnline({ ...base, payment_status: null })).toBe(false);
  });
});

describe("payment API client", () => {
  it("sends the selected payment method and the stored token", async () => {
    sessionStorage.setItem("fitkitchen.access-token", "test-token");
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          success: true,
          data: {
            id: "6",
            created_at: null,
            delivery_date: "2026-11-26",
            total_amount: "65000.00",
            shipping_fee: "0.00",
            status: "PENDING",
            payment_method: "ONLINE",
            payment_status: "PENDING",
            delivery_time_slot: null,
            payment: { provider: "VNPAY", redirect_url: null },
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await orderApi.checkout({
      address_id: "1",
      delivery_date: "2026-11-26",
      payment_method: "ONLINE",
    });
    expect(response.data.payment).toEqual({ provider: "VNPAY", redirect_url: null });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/orders/checkout");
    expect(JSON.parse(String(init.body))).toMatchObject({ payment_method: "ONLINE" });
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
  });

  it("defaults checkout to cash on delivery", async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: false }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      orderApi.checkout({ address_id: "1", delivery_date: "2026-11-26" }),
    ).rejects.toThrow();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ payment_method: "COD" });
  });

  it("creates a VNPay payment and reads the payment status of an order", async () => {
    const fetchMock = vi.fn(async (input: string) =>
      input.endsWith("/payments/vnpay")
        ? Response.json({
            success: true,
            data: {
              provider: "VNPAY",
              order_id: "6",
              txn_ref: "6A2T20261126012212",
              expires_at: "2026-11-25T18:37:12.877Z",
              redirect_url: `${VNPAY_ORIGIN}/paymentv2/vpcpay.html?x=1`,
            },
          })
        : Response.json({
            success: true,
            data: {
              order_id: "6",
              order_status: "PENDING",
              payment_method: "ONLINE",
              payment_status: "PAID",
              total_amount: "65000.00",
              can_retry: false,
              latest_transaction: null,
            },
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const payment = await orderApi.createVnpayPayment("6");
    expect(payment.data.txn_ref).toBe("6A2T20261126012212");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ order_id: "6" });

    const status = await orderApi.paymentStatus("6");
    expect(status.data.payment_status).toBe("PAID");
    expect(status.data.total_amount).toBe(65000);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/payments/orders/6");
  });
});
