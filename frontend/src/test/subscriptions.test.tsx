import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionManager } from "@/components/admin/subscription-manager";
import { SubscriptionPlans } from "@/components/subscription-plans";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { computeEndDate, validateStartDateInWindow } from "@/lib/subscription-api";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      to,
      children,
      ...props
    }: {
      to: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const samplePlans = [
  {
    id: "1",
    name: "Gói Eat Clean 7 ngày",
    description: "14 bữa ăn Eat Clean, giao trưa và tối mỗi ngày",
    duration_days: 7,
    meals_per_day: 2,
    price: "850000.00",
    is_active: true,
    in_progress_count: 1,
    pending_count: 0,
    gifts: [
      {
        id: "10",
        product_id: "3",
        product_name: "Thanh protein hạt điều",
        gift_name: "Tặng 2 thanh protein hạt điều",
        description: "Quà tặng khi đăng ký gói Eat Clean 7 ngày",
        quantity: 2,
      },
    ],
  },
  {
    id: "2",
    name: "Gói Bulking 30 ngày",
    description: "60 bữa ăn giàu protein dành cho mục tiêu tăng cơ",
    duration_days: 30,
    meals_per_day: 2,
    price: "3600000.00",
    is_active: true,
    in_progress_count: 2,
    pending_count: 1,
    gifts: [
      {
        id: "11",
        product_id: "1",
        product_name: "Whey Protein vị vani",
        gift_name: "Tặng 1 túi Whey Protein vị vani",
        description: "Quà tặng kèm gói 30 ngày",
        quantity: 1,
      },
    ],
  },
];

const checkoutWindow = {
  earliest_start_date: "2026-11-22",
  latest_start_date: "2026-12-21",
};

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

function renderWithQuery(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("Subscription start/end date validation", () => {
  it("computes inclusive end dates across month boundaries without timezone drift", () => {
    expect(computeEndDate("2026-11-22", 7)).toBe("2026-11-28");
    expect(computeEndDate("2026-11-22", 30)).toBe("2026-12-21");
    expect(computeEndDate("2026-02-29", 7)).toBeNull();
  });

  it("enforces the allowed start window and prevents overlapping active or pending plans", () => {
    const existing = [
      {
        plan_name: "Gói Eat Clean 7 ngày",
        status: "ACTIVE",
        start_date: "2026-11-25",
        end_date: "2026-12-01",
      },
    ];

    // Before earliest start date
    expect(validateStartDateInWindow("2026-11-21", 7, checkoutWindow, existing).valid).toBe(false);

    // Overlaps existing active subscription (2026-11-22..2026-11-28 overlaps 2026-11-25..2026-12-01)
    const overlapCheck = validateStartDateInWindow("2026-11-22", 7, checkoutWindow, existing);
    expect(overlapCheck.valid).toBe(false);
    expect(overlapCheck.error).toMatch(/already covers 25\/11\/2026–01\/12\/2026/);

    // Starts after existing plan ends
    const validCheck = validateStartDateInWindow("2026-12-02", 7, checkoutWindow, existing);
    expect(validCheck).toEqual({
      valid: true,
      endDate: "2026-12-08",
      error: null,
    });
  });
});

describe("Customer SubscriptionPlans and checkout", () => {
  it("displays 7-day and 30-day plans with gifts, validates start/end dates, and submits checkout", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "customer-token");
    const checkoutBodies: unknown[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = new URL(input, "http://localhost");
        if (url.pathname === "/api/subscription-plans") {
          return json({
            success: true,
            data: samplePlans,
            checkout_window: checkoutWindow,
          });
        }
        if (url.pathname === "/api/session") {
          return json({
            success: true,
            data: {
              id: "2",
              full_name: "Linh Nguyen",
              role: "CUSTOMER",
              is_locked: false,
            },
          });
        }
        if (url.pathname === "/api/users/2/addresses") {
          return json({
            success: true,
            data: [
              {
                id: "5",
                recipient_name: "Linh Nguyen",
                phone: "0901234567",
                address_detail: "123 Nguyen Hue, Q1, TP.HCM",
                is_default: true,
              },
            ],
          });
        }
        if (url.pathname === "/api/subscriptions/me") {
          return json({
            success: true,
            data: [
              {
                id: "90",
                plan_id: "1",
                plan_name: "Gói Eat Clean 7 ngày",
                duration_days: 7,
                meals_per_day: 2,
                start_date: "2026-11-22",
                end_date: "2026-11-28",
                status: "ACTIVE",
                phase: "IN_PROGRESS",
                payment_method: "COD",
                payment_status: "PAID",
                total_amount: "850000.00",
                created_at: null,
                recipient_name: "Linh Nguyen",
                address_phone: "0901234567",
                address_detail: "123 Nguyen Hue, Q1, TP.HCM",
                gifts: [],
              },
            ],
          });
        }
        if (url.pathname === "/api/subscriptions/checkout" && init?.method === "POST") {
          const payload = JSON.parse(String(init.body));
          checkoutBodies.push(payload);
          return json(
            {
              success: true,
              data: {
                id: "91",
                plan_id: payload.plan_id,
                plan_name: "Gói Eat Clean 7 ngày",
                duration_days: 7,
                meals_per_day: 2,
                start_date: payload.start_date,
                end_date: "2026-12-06",
                status: "PENDING",
                phase: "PENDING",
                payment_method: "COD",
                payment_status: "PENDING",
                total_amount: "850000.00",
                created_at: null,
                recipient_name: "Linh Nguyen",
                address_phone: "0901234567",
                address_detail: "123 Nguyen Hue, Q1, TP.HCM",
                gifts: samplePlans[0]!.gifts,
              },
            },
            201,
          );
        }
        return json({}, 404);
      }),
    );

    renderWithQuery(<SubscriptionPlans />);

    // Both 7-day and 30-day plans appear
    expect(await screen.findByText("Gói Eat Clean 7 ngày")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gói Bulking 30 ngày" })).toBeInTheDocument();

    // Select 7-day plan and inspect gifts
    fireEvent.click(screen.getByRole("button", { name: /Gói Eat Clean 7 ngày/i }));
    expect(screen.getAllByText(/Tặng 2 thanh protein hạt điều/i).length).toBeGreaterThan(0);

    // Open checkout dialog
    fireEvent.click(screen.getByRole("button", { name: /Register this plan/i }));
    const dialog = await screen.findByRole("dialog");

    // Default start date (2026-11-22) overlaps existing active subscription (2026-11-22..2026-11-28)
    expect(
      await within(dialog).findByText(/already covers 22\/11\/2026–28\/11\/2026/i),
    ).toBeInTheDocument();

    const submitButton = await within(dialog).findByRole("button", {
      name: /Confirm subscription/i,
    });
    expect(submitButton).toBeDisabled();

    // Change start date to 2026-11-30 (after overlap)
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-11-30" },
    });
    expect(within(dialog).getByText("06/12/2026 (7 days)")).toBeInTheDocument();
    await waitFor(() => expect(submitButton).toBeEnabled());

    fireEvent.click(submitButton);
    await waitFor(() =>
      expect(checkoutBodies).toEqual([
        {
          plan_id: "1",
          address_id: "5",
          start_date: "2026-11-30",
          payment_method: "COD",
        },
      ]),
    );
    expect(await screen.findByText(/Subscription registered:/i)).toBeInTheDocument();
  });
});

describe("Admin SubscriptionManager", () => {
  it("lists active customer subscriptions and configures subscription plans", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input, "http://localhost");
        if (url.pathname === "/api/admin/subscription-plans") {
          return json({ success: true, data: samplePlans });
        }
        if (url.pathname === "/api/admin/subscriptions") {
          return json({
            success: true,
            data: [
              {
                id: "90",
                user_id: "2",
                customer_name: "Linh Nguyen",
                customer_email: "linh@example.test",
                customer_phone: "0901234567",
                plan_id: "1",
                plan_name: "Gói Eat Clean 7 ngày",
                duration_days: 7,
                meals_per_day: 2,
                start_date: "2026-11-22",
                end_date: "2026-11-28",
                status: "PENDING",
                phase: "PENDING",
                payment_method: "COD",
                payment_status: "PENDING",
                total_amount: "850000.00",
                created_at: null,
                recipient_name: "Linh Nguyen",
                address_phone: "0901234567",
                address_detail: "123 Nguyen Hue, Q1, TP.HCM",
                gifts: samplePlans[0]!.gifts,
              },
            ],
            pagination: { page: 1, page_size: 20, total: 1 },
          });
        }
        return json({}, 404);
      }),
    );

    renderWithQuery(<SubscriptionManager />);

    expect((await screen.findAllByText("Linh Nguyen")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gói Eat Clean 7 ngày").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Activate subscription for Linh Nguyen" }).length,
    ).toBeGreaterThan(0);
  });
});
