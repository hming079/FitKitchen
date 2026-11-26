import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartDrawer } from "@/components/cart-drawer";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { browserNavigation, VNPAY_ORIGIN } from "@/lib/order-api";
import { useCartStore } from "@/stores/cart-store";

const VNPAY_URL = `${VNPAY_ORIGIN}/paymentv2/vpcpay.html?vnp_TxnRef=6A1T20261126010506`;
let assign: ReturnType<typeof vi.spyOn>;
let checkoutBodies: unknown[];

const cart = {
  id: "1",
  items: [
    {
      id: "10",
      meal_id: "1",
      quantity: 1,
      name: "Grilled chicken with asparagus",
      description: null,
      image_url: null,
      price: "65000.00",
      calories: "450.00",
      protein_g: "40.00",
      carbs_g: "45.00",
      fat_g: "10.00",
      unit_price: "65000.00",
      line_total: "65000.00",
      customizations: [],
    },
  ],
  item_count: 1,
  subtotal: "65000.00",
  currency: "VND",
};
const emptyCart = { ...cart, items: [], item_count: 0, subtotal: "0.00" };

function placedOrder(redirectUrl: string | null) {
  return {
    id: "6",
    created_at: null,
    delivery_date: "2026-11-27",
    total_amount: "65000.00",
    shipping_fee: "0.00",
    status: "PENDING",
    payment_method: "ONLINE",
    payment_status: "PENDING",
    delivery_time_slot: null,
    payment: { provider: "VNPAY", redirect_url: redirectUrl },
  };
}

function mockApi({
  checkoutUrl,
  retryUrl,
  promotion,
}: {
  checkoutUrl: string | null;
  retryUrl?: string;
  promotion?: boolean;
}) {
  let ordered = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = input.replace(/^\/api/, "");
      if (path === "/cart")
        return Response.json({ success: true, data: ordered ? emptyCart : cart });
      if (path === "/session")
        return Response.json({
          success: true,
          data: { id: "6", full_name: "Demo Customer", role: "CUSTOMER", is_locked: false },
        });
      if (path === "/users/6/addresses")
        return Response.json({
          success: true,
          data: [
            {
              id: "3",
              recipient_name: "Demo Customer",
              phone: "0900000201",
              address_detail: "1 Le Loi, District 1",
              is_default: true,
            },
          ],
        });
      if (path === "/promotions/validate" && promotion)
        return Response.json({
          success: true,
          data: {
            promotion_id: "9",
            code: "SAVE10",
            discount_type: "PERCENTAGE",
            discount_value: 10,
            subtotal: 65000,
            discount_amount: 6500,
            total_amount: 58500,
          },
        });
      if (path === "/orders/checkout") {
        ordered = true;
        checkoutBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ success: true, data: placedOrder(checkoutUrl) }, { status: 201 });
      }
      if (path === "/payments/vnpay")
        return Response.json({
          success: true,
          data: {
            provider: "VNPAY",
            order_id: "6",
            txn_ref: "6A2T20261126012212",
            expires_at: "2026-11-25T18:37:12.877Z",
            redirect_url: retryUrl ?? VNPAY_URL,
          },
        });
      return Response.json(
        { success: false, code: "NOT_FOUND", message: "Not found" },
        { status: 404 },
      );
    }),
  );
}

async function checkoutWithVnpay(code?: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CartDrawer />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /open cart/i }));
  fireEvent.click(await screen.findByRole("button", { name: /checkout/i }));
  if (code) {
    fireEvent.change(screen.getByLabelText("Discount code"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText(/SAVE10 applied/);
  }
  fireEvent.click(await screen.findByRole("radio", { name: "VNPay" }));
  const submit = await screen.findByRole("button", { name: /pay with vnpay/i });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
}

beforeEach(() => {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, "test-token");
  checkoutBodies = [];
  assign = vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
  // Radix RadioGroup measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useCartStore.setState({ items: [], itemCount: 0, subtotal: 0, isLoading: false, error: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("cart checkout with VNPay", () => {
  it("applies a validated code to the displayed total and checkout request", async () => {
    mockApi({ checkoutUrl: VNPAY_URL, promotion: true });
    await checkoutWithVnpay("save10");
    const payButton = screen.getByRole("button", { name: /pay with vnpay/i });
    expect(payButton.textContent).toContain("58.500");
    await waitFor(() => expect(checkoutBodies[0]).toMatchObject({
      payment_method: "ONLINE",
      address_id: "3",
      promotion_code: "SAVE10",
    }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(VNPAY_URL));
  });

  it("sends ONLINE and opens the VNPay Sandbox page", async () => {
    mockApi({ checkoutUrl: VNPAY_URL });
    await checkoutWithVnpay();
    await waitFor(() => expect(assign).toHaveBeenCalledWith(VNPAY_URL));
    expect(checkoutBodies[0]).toMatchObject({ payment_method: "ONLINE", address_id: "3" });
    expect(await screen.findByRole("status")).toHaveTextContent(/opening vnpay/i);
  });

  it("does not follow a redirect to another origin and offers a retry", async () => {
    mockApi({ checkoutUrl: "https://sandbox.vnpayment.vn.evil.example/pay" });
    await checkoutWithVnpay();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be opened/i);
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try payment again" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(VNPAY_URL));
  });

  it("shows a retry when checkout returns no payment URL", async () => {
    mockApi({ checkoutUrl: null, retryUrl: "javascript:alert(1)" });
    await checkoutWithVnpay();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be opened/i);
    fireEvent.click(screen.getByRole("button", { name: "Try payment again" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not be opened/i),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
