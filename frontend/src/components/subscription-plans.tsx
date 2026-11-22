import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Clock3,
  Gift,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { ACCESS_TOKEN_KEY, api, ApiError, sessionSchema } from "@/lib/admin-api";
import { vnd } from "@/components/admin/catalog/catalog-data";
import {
  computeEndDate,
  formatCalendarDate,
  subscriptionApi,
  validateStartDateInWindow,
  type CheckoutWindow,
  type CustomerSubscription,
  type SubscriptionPlan,
} from "@/lib/subscription-api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const perks = [
  {
    Icon: Clock3,
    title: "Fixed delivery windows",
    note: "Daily meals prepared for your lunch and dinner schedule",
  },
  {
    Icon: RefreshCw,
    title: "Flexible meal swapping",
    note: "Request meal swaps on upcoming scheduled deliveries",
  },
  {
    Icon: Gift,
    title: "Included plan gifts",
    note: "Bonus protein bars or supplements bundled with your plan",
  },
  {
    Icon: Sparkles,
    title: "Nutrition analytics",
    note: "Track daily calories and macros across your routine",
  },
];

// Clearly labeled fallback preview plans shown only when the backend API is unreachable.
const previewPlans: SubscriptionPlan[] = [
  {
    id: "1",
    name: "Gói Eat Clean 7 ngày",
    description: "14 bữa ăn Eat Clean, giao trưa và tối mỗi ngày",
    duration_days: 7,
    meals_per_day: 2,
    price: 850000,
    is_active: true,
    gifts: [
      {
        id: "1",
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
    price: 3600000,
    is_active: true,
    gifts: [
      {
        id: "2",
        product_id: "1",
        product_name: "Whey Protein vị vani",
        gift_name: "Tặng 1 túi Whey Protein vị vani",
        description: "Quà tặng kèm khi đăng ký gói Bulking 30 ngày",
        quantity: 1,
      },
    ],
  },
];

const emptyPlans: SubscriptionPlan[] = [];

export function SubscriptionPhaseBadge({ phase }: { phase: CustomerSubscription["phase"] }) {
  switch (phase) {
    case "IN_PROGRESS":
      return <Badge variant="success">Active</Badge>;
    case "UPCOMING":
      return <Badge variant="info">Upcoming</Badge>;
    case "PENDING":
      return <Badge variant="warning">Pending confirmation</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "ENDED":
      return <Badge variant="secondary">Completed</Badge>;
  }
}

function defaultCheckoutWindow(): CheckoutWindow {
  const now = new Date();
  const base = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const earliest = new Date(base);
  earliest.setUTCDate(earliest.getUTCDate() + 1);
  const latest = new Date(base);
  latest.setUTCDate(latest.getUTCDate() + 30);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return {
    earliest_start_date: fmt(earliest),
    latest_start_date: fmt(latest),
  };
}

function SubscriptionCheckoutDialog({
  plan,
  window: checkoutWindow,
  isSamplePreview,
  onClose,
  onSuccess,
}: {
  plan: SubscriptionPlan;
  window: CheckoutWindow;
  isSamplePreview: boolean;
  onClose: () => void;
  onSuccess: (created: CustomerSubscription) => void;
}) {
  const queryClient = useQueryClient();
  const startDateInputId = useId();
  const addressSelectId = useId();
  const [startDate, setStartDate] = useState(checkoutWindow.earliest_start_date);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressError, setAddressError] = useState("");

  const hasToken =
    typeof window !== "undefined" && Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));

  const sessionQuery = useQuery({
    queryKey: ["session", "subscription-checkout"],
    queryFn: ({ signal }) => api("/session", sessionSchema, { signal }),
    enabled: hasToken && !isSamplePreview,
    retry: false,
  });

  const customerUser = sessionQuery.data?.data.role === "CUSTOMER" ? sessionQuery.data.data : null;

  const addressesQuery = useQuery({
    queryKey: ["customer", "addresses", customerUser?.id],
    queryFn: ({ signal }) => subscriptionApi.listAddresses(customerUser!.id, signal),
    enabled: Boolean(customerUser) && !isSamplePreview,
    retry: false,
  });

  const mySubscriptionsQuery = useQuery({
    queryKey: ["customer", "subscriptions"],
    queryFn: ({ signal }) => subscriptionApi.listMySubscriptions(signal),
    enabled: Boolean(customerUser) && !isSamplePreview,
    retry: false,
  });

  useEffect(() => {
    const list = addressesQuery.data?.data;
    if (!list || list.length === 0) return;
    if (!selectedAddressId || !list.some((item) => item.id === selectedAddressId)) {
      const preferred = list.find((item) => item.is_default) ?? list[0];
      if (preferred) setSelectedAddressId(preferred.id);
    }
  }, [addressesQuery.data, selectedAddressId]);

  const dateCheck = validateStartDateInWindow(
    startDate,
    plan.duration_days,
    checkoutWindow,
    mySubscriptionsQuery.data?.data ?? [],
  );

  const createAddressMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.createAddress(customerUser!.id, {
        recipient_name: recipientName.trim(),
        phone: phone.trim(),
        address_detail: addressDetail.trim(),
        is_default: (addressesQuery.data?.data.length ?? 0) === 0,
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: ["customer", "addresses", customerUser?.id],
      });
      setSelectedAddressId(res.data.id);
      setAddingAddress(false);
      setRecipientName("");
      setPhone("");
      setAddressDetail("");
      setAddressError("");
    },
    onError: (err) => {
      setAddressError(err instanceof Error ? err.message : "Could not save address.");
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.checkout({
        plan_id: plan.id,
        address_id: selectedAddressId,
        start_date: startDate,
        payment_method: "COD",
      }),
    onSuccess: async (res) => {
      if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
        window.localStorage.setItem("fitfuel-premium-preview", "active");
        window.localStorage.setItem("fitfuel-premium-plan", plan.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["customer", "subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      onSuccess(res.data);
    },
  });

  function handleSaveAddress() {
    setAddressError("");
    if (!recipientName.trim() || !phone.trim() || !addressDetail.trim()) {
      setAddressError("Fill in recipient name, phone number, and street address.");
      return;
    }
    createAddressMutation.mutate();
  }

  function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dateCheck.valid || !selectedAddressId || checkoutMutation.isPending) return;
    checkoutMutation.mutate();
  }

  const totalMeals = plan.duration_days * plan.meals_per_day;
  const addresses = addressesQuery.data?.data ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !checkoutMutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl">{plan.name}</DialogTitle>
          <DialogDescription>
            {plan.description ||
              `${plan.duration_days} days · ${plan.meals_per_day} meals per day (${totalMeals} meals total)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Plan summary */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-secondary/40 p-3.5 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-0.5 font-semibold tabular-nums">{plan.duration_days} days</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Meals included</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {plan.meals_per_day}/day · {totalMeals} total
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan price</p>
              <p className="mt-0.5 font-semibold tabular-nums">{vnd.format(plan.price)}</p>
            </div>
          </div>

          {/* Attached gifts */}
          <section aria-label="Included gifts" className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Gift className="size-4 text-primary" aria-hidden />
              Included gifts ({plan.gifts.length})
            </h3>
            {plan.gifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No promotional gifts are bundled with this plan.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {plan.gifts.map((gift) => (
                  <li key={gift.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium [overflow-wrap:anywhere]">{gift.gift_name}</p>
                      {gift.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {gift.description}
                        </p>
                      )}
                      {gift.product_name && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Product: {gift.product_name}
                        </p>
                      )}
                    </div>
                    <Badge variant="info" className="shrink-0 tabular-nums">
                      ×{gift.quantity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Start & End date condition checker */}
          <section aria-label="Subscription schedule" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={startDateInputId}>Start date</Label>
                <Input
                  id={startDateInputId}
                  type="date"
                  className="h-11"
                  value={startDate}
                  min={checkoutWindow.earliest_start_date}
                  max={checkoutWindow.latest_start_date}
                  aria-invalid={dateCheck.error ? true : undefined}
                  aria-describedby={
                    dateCheck.error ? `${startDateInputId}-error` : `${startDateInputId}-hint`
                  }
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    checkoutMutation.reset();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium leading-none">Calculated end date</span>
                <div
                  aria-live="polite"
                  className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-sm font-medium tabular-nums"
                >
                  {dateCheck.endDate
                    ? `${formatCalendarDate(dateCheck.endDate)} (${plan.duration_days} days)`
                    : "Select a valid start date"}
                </div>
              </div>
            </div>
            <p id={`${startDateInputId}-hint`} className="text-xs text-muted-foreground">
              Allowed start window: {formatCalendarDate(checkoutWindow.earliest_start_date)} to{" "}
              {formatCalendarDate(checkoutWindow.latest_start_date)} (at least 1 day lead time for
              kitchen prep).
            </p>
            {dateCheck.error && (
              <p id={`${startDateInputId}-error`} role="alert" className="text-sm text-destructive">
                {dateCheck.error}
              </p>
            )}
          </section>

          {/* Checkout section depending on connectivity & session */}
          {isSamplePreview ? (
            <Alert variant="info" role="note">
              <AlertDescription>
                Live subscription service is currently offline. You can inspect plan details, gifts,
                and start/end date validation above; connect the backend to place a subscription.
              </AlertDescription>
            </Alert>
          ) : !hasToken || (sessionQuery.isError && !sessionQuery.isPending) ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-semibold">Sign in to subscribe</p>
                <p className="mt-0.5 text-muted-foreground">
                  Sign in with a customer account to choose your delivery address and complete
                  checkout.
                </p>
              </div>
              <Button asChild className="min-h-11 shrink-0">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          ) : sessionQuery.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your account session…
            </p>
          ) : sessionQuery.data?.data.role === "ADMIN" ? (
            <Alert variant="info" role="note">
              <AlertDescription>
                You are signed in as an administrator. Customer subscription checkout requires a
                customer account, or manage plans in{" "}
                <Link to="/admin" className="font-semibold underline">
                  Kitchen operations
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : (
            <form
              id="subscription-checkout-form"
              onSubmit={handleCheckoutSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={addressSelectId}>Delivery address</Label>
                  {!addingAddress && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setAddingAddress(true)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Add new address
                    </Button>
                  )}
                </div>

                {addressesQuery.isPending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading saved addresses…
                  </p>
                ) : addresses.length > 0 && !addingAddress ? (
                  <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                    <SelectTrigger id={addressSelectId} className="h-11 w-full">
                      <SelectValue placeholder="Choose a delivery address" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id} className="min-h-11">
                          {addr.recipient_name} ({addr.phone}) — {addr.address_detail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : !addingAddress ? (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3.5 text-sm">
                    <p className="text-muted-foreground">
                      You don’t have a saved delivery address yet.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 min-h-11"
                      onClick={() => setAddingAddress(true)}
                    >
                      Add delivery address
                    </Button>
                  </div>
                ) : null}
              </div>

              {addingAddress && (
                <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="text-sm font-semibold">New delivery address</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-addr-recipient">Recipient name</Label>
                      <Input
                        id="new-addr-recipient"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="h-11"
                        maxLength={150}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-addr-phone">Phone number</Label>
                      <Input
                        id="new-addr-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11"
                        maxLength={20}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-addr-detail">Street address</Label>
                    <Textarea
                      id="new-addr-detail"
                      rows={2}
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                    />
                  </div>
                  {addressError && (
                    <p role="alert" className="text-sm text-destructive">
                      {addressError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="min-h-11"
                      disabled={createAddressMutation.isPending}
                      onClick={handleSaveAddress}
                    >
                      {createAddressMutation.isPending ? "Saving…" : "Save address"}
                    </Button>
                    {addresses.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={createAddressMutation.isPending}
                        onClick={() => {
                          setAddingAddress(false);
                          setAddressError("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3.5 py-3 text-sm">
                <div>
                  <p className="font-medium">Payment method</p>
                  <p className="text-xs text-muted-foreground">
                    Cash on delivery (COD) · confirmed on your first scheduled delivery
                  </p>
                </div>
                <Badge variant="outline">COD</Badge>
              </div>

              {checkoutMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {checkoutMutation.error instanceof ApiError
                      ? checkoutMutation.error.message
                      : "Could not complete subscription checkout. Please try again."}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={checkoutMutation.isPending}
            onClick={onClose}
          >
            Close
          </Button>
          {customerUser && !isSamplePreview && (
            <Button
              type="submit"
              form="subscription-checkout-form"
              className="min-h-11"
              disabled={
                !dateCheck.valid ||
                !selectedAddressId ||
                addingAddress ||
                checkoutMutation.isPending
              }
            >
              {checkoutMutation.isPending
                ? "Submitting…"
                : `Confirm subscription · ${vnd.format(plan.price)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionPlans() {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [recentSubscription, setRecentSubscription] = useState<CustomerSubscription | null>(null);

  const plansQuery = useQuery({
    queryKey: ["public", "subscription-plans"],
    queryFn: ({ signal }) => subscriptionApi.listPublicPlans(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isSampleFallback = plansQuery.isError && !plansQuery.data;
  const plans = plansQuery.data?.data ?? (isSampleFallback ? previewPlans : emptyPlans);
  const checkoutWindow = plansQuery.data?.checkout_window ?? defaultCheckoutWindow();

  useEffect(() => {
    if (plans.length === 0) return;
    if (!selectedPlanId || !plans.some((p) => p.id === selectedPlanId)) {
      const preferred = plans.find((p) => p.duration_days === 30) ?? plans[0];
      if (preferred) setSelectedPlanId(preferred.id);
    }
  }, [plans, selectedPlanId]);

  const activePlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  return (
    <section
      id="plans"
      aria-labelledby="subscription-plans-heading"
      className="border-y border-border bg-secondary/60"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:px-12">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-coral">
            <Sparkles className="size-4" aria-hidden /> FitFuel Plus · Meal subscriptions
          </p>
          <h2
            id="subscription-plans-heading"
            className="mt-3 max-w-lg font-display text-4xl font-bold leading-tight sm:text-5xl"
          >
            Your week, fueled on autopilot.
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
            Compare 7-day and 30-day meal packages, review included bonus gifts, and schedule your
            start date with automatic delivery window checks.
          </p>

          {recentSubscription && (
            <Alert variant="success" role="status" className="mt-5">
              <AlertDescription>
                Subscription registered: <strong>{recentSubscription.plan_name}</strong> from{" "}
                <strong>{formatCalendarDate(recentSubscription.start_date)}</strong> to{" "}
                <strong>{formatCalendarDate(recentSubscription.end_date)}</strong> (
                {vnd.format(recentSubscription.total_amount)} · {recentSubscription.payment_method}
                ).{" "}
                <Link to="/dashboard" className="font-semibold underline">
                  View in your fuel tracker
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {isSampleFallback && (
            <Alert variant="info" role="note" className="mt-5">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Live subscription catalog is offline. Sample 7-day and 30-day plan previews are
                  shown below.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void plansQuery.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {plansQuery.isPending ? (
            <div
              role="status"
              className="mt-7 flex min-h-40 items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              Loading subscription plans…
            </div>
          ) : plans.length === 0 ? (
            <p role="status" className="mt-7 text-sm text-muted-foreground">
              No subscription plans are currently open for registration.
            </p>
          ) : (
            <>
              <div
                className="mt-7 grid gap-4 sm:grid-cols-2"
                role="group"
                aria-label="Available subscription plans"
              >
                {plans.map((plan) => {
                  const selected = activePlan?.id === plan.id;
                  const totalMeals = plan.duration_days * plan.meals_per_day;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      aria-pressed={selected}
                      className={`relative flex min-h-44 flex-col justify-between rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected
                          ? "border-primary bg-background"
                          : "border-border bg-card/70 hover:bg-background"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-base font-semibold [overflow-wrap:anywhere]">
                            {plan.name}
                          </span>
                          <Badge variant={plan.duration_days >= 30 ? "info" : "secondary"}>
                            {plan.duration_days} days
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.meals_per_day} meals/day · {totalMeals} meals total
                        </p>
                        {plan.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {plan.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 border-t border-border pt-3">
                        <span className="block font-display text-2xl font-bold tabular-nums">
                          {vnd.format(plan.price)}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Gift className="size-3.5 shrink-0 text-primary" aria-hidden />
                          {plan.gifts.length > 0
                            ? `${plan.gifts.length} included ${plan.gifts.length === 1 ? "gift" : "gifts"}: ${plan.gifts.map((g) => `${g.gift_name} (×${g.quantity})`).join(", ")}`
                            : "Standard meal delivery package"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {activePlan && (
                <div className="mt-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold">{activePlan.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activePlan.description ||
                          `${activePlan.duration_days} days · ${activePlan.meals_per_day} meals/day`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold tabular-nums">
                        {vnd.format(activePlan.price)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {vnd.format(
                          Math.round(
                            activePlan.price /
                              (activePlan.duration_days * activePlan.meals_per_day),
                          ),
                        )}{" "}
                        / meal
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Duration</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 font-semibold tabular-nums">
                        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                        {activePlan.duration_days} days
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Daily portions</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 font-semibold tabular-nums">
                        <UtensilsCrossed className="size-4 text-muted-foreground" aria-hidden />
                        {activePlan.meals_per_day} meals / day (
                        {activePlan.duration_days * activePlan.meals_per_day} meals)
                      </dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-xs text-muted-foreground">Example schedule</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {formatCalendarDate(checkoutWindow.earliest_start_date)} →{" "}
                        {formatCalendarDate(
                          computeEndDate(
                            checkoutWindow.earliest_start_date,
                            activePlan.duration_days,
                          ) ?? checkoutWindow.earliest_start_date,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 space-y-2">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Gift className="size-3.5 text-primary" aria-hidden />
                      Gifts included with this plan
                    </p>
                    {activePlan.gifts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No bonus gifts configured for this plan.
                      </p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {activePlan.gifts.map((gift) => (
                          <li
                            key={gift.id}
                            className="flex items-start justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium [overflow-wrap:anywhere]">
                                {gift.gift_name}
                              </p>
                              {gift.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                  {gift.description}
                                </p>
                              )}
                            </div>
                            <Badge variant="info" className="shrink-0 tabular-nums">
                              ×{gift.quantity}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      className="min-h-11 rounded-sm font-bold"
                      onClick={() => setCheckoutPlan(activePlan)}
                    >
                      Register this plan <ArrowRight className="size-4" aria-hidden />
                    </Button>
                    <Button asChild variant="outline" className="min-h-11 rounded-sm">
                      <Link to="/dashboard">View my subscriptions</Link>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid content-center gap-0 divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-y-0 sm:border-0">
          {perks.map(({ Icon, title, note }, index) => (
            <article
              key={title}
              className={`flex gap-4 py-5 sm:px-5 sm:py-6 ${index % 2 === 1 ? "sm:border-l" : ""} ${index >= 2 ? "sm:border-t" : ""} border-border`}
            >
              <span className="grid size-11 shrink-0 place-items-center bg-background text-fresh">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold leading-snug">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{note}</p>
              </div>
            </article>
          ))}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 sm:px-5">
            <CalendarClock className="size-4 text-coral" aria-hidden /> Start dates require 1–30
            days advance notice and automatically prevent overlapping active plans.
          </div>
        </div>
      </div>

      {checkoutPlan && (
        <SubscriptionCheckoutDialog
          plan={checkoutPlan}
          window={checkoutWindow}
          isSamplePreview={isSampleFallback}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={(created) => {
            setCheckoutPlan(null);
            setRecentSubscription(created);
          }}
        />
      )}
    </section>
  );
}

export function CustomerSubscriptionsPanel() {
  const query = useQuery({
    queryKey: ["customer", "subscriptions"],
    queryFn: ({ signal }) => subscriptionApi.listMySubscriptions(signal),
    retry: false,
  });

  return (
    <section
      aria-labelledby="customer-subscriptions-heading"
      className="mt-8 rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="customer-subscriptions-heading" className="font-display text-2xl font-bold">
            Your meal subscriptions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your registered 7-day and 30-day plans, delivery dates, and bundled gifts.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11 rounded-sm">
          <a href="/#plans">Browse plans</a>
        </Button>
      </div>

      {query.isPending ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading your subscriptions…
        </p>
      ) : query.isError ? (
        <div className="mt-4 space-y-3">
          <Alert variant="destructive">
            <AlertDescription>
              Could not load your subscriptions. {query.error.message}
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="min-h-11" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.data.data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-5 text-sm">
          <p className="font-medium">You don’t have any meal subscriptions yet.</p>
          <p className="mt-1 text-muted-foreground">
            Choose a 7-day or 30-day meal package on the menu page to schedule recurring deliveries
            and claim your plan gifts.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2" aria-label="Registered subscriptions">
          {query.data.data.map((sub) => (
            <li
              key={sub.id}
              className="flex flex-col justify-between rounded-lg border border-border bg-background p-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold [overflow-wrap:anywhere]">
                      {sub.plan_name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {sub.duration_days} days · {sub.meals_per_day} meals/day (
                      {sub.duration_days * sub.meals_per_day} meals)
                    </p>
                  </div>
                  <SubscriptionPhaseBadge phase={sub.phase} />
                </div>

                <dl className="grid grid-cols-2 gap-2 border-y border-border py-2.5 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Schedule</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatCalendarDate(sub.start_date)} – {formatCalendarDate(sub.end_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total & payment</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {vnd.format(sub.total_amount)} · {sub.payment_method} (
                      {sub.payment_status ?? "PENDING"})
                    </dd>
                  </div>
                  {sub.address_detail && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Delivery address</dt>
                      <dd className="mt-0.5 flex items-start gap-1.5 text-xs [overflow-wrap:anywhere]">
                        <MapPin
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span>
                          {sub.recipient_name ? `${sub.recipient_name} · ` : ""}
                          {sub.address_detail}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>

                {sub.gifts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Gift className="size-3.5 text-primary" aria-hidden />
                      Included gifts
                    </p>
                    <ul className="space-y-1 text-xs">
                      {sub.gifts.map((gift) => (
                        <li
                          key={gift.id}
                          className="flex items-center justify-between gap-2 rounded bg-secondary/50 px-2.5 py-1.5"
                        >
                          <span className="[overflow-wrap:anywhere]">{gift.gift_name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            ×{gift.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
