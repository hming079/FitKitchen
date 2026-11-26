import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { StoreHeader } from "@/components/store-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ACCESS_TOKEN_KEY, ApiError } from "@/lib/admin-api";
import { openVnpayPage, orderApi, type PaymentStatus } from "@/lib/order-api";

export const POLL_INTERVAL_MS = 3000;
export const POLL_LIMIT_MS = 60000;

// The backend payment status (updated by the signed IPN) is always the source of truth.
// VNPay's `result` value only chooses wording while the backend still reports PENDING.
// The router parses `?order_id=6` as a number; keeping it numeric avoids a canonicalizing
// redirect to `?order_id="6"`.
const searchSchema = z.object({
  order_id: z
    .union([z.string().regex(/^[1-9]\d*$/), z.number()])
    .transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .optional()
    .catch(undefined),
  result: z.enum(["success", "failed", "invalid"]).optional().catch(undefined),
});
export type VnpayResultHint = z.infer<typeof searchSchema>["result"];

export const Route = createFileRoute("/payment/result")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  component: PaymentResultPage,
});

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function awaitingConfirmation(payment: PaymentStatus) {
  return (
    payment.payment_method === "ONLINE" &&
    payment.payment_status === "PENDING" &&
    payment.order_status !== "CANCELLED"
  );
}

function PaymentResultPage() {
  const { order_id, result } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <StoreHeader />
      <main className="mx-auto max-w-lg px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <PaymentResult
          orderId={order_id === undefined ? undefined : String(order_id)}
          vnpayResult={result}
        />
      </main>
    </div>
  );
}

export function PaymentResult({
  orderId,
  vnpayResult,
}: {
  orderId: string | undefined;
  vnpayResult?: VnpayResultHint;
}) {
  const hasToken =
    typeof window !== "undefined" && Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));
  // VNPay sent the customer back without a successful payment; while the backend still says
  // PENDING, do not keep the customer waiting on a minute of polling.
  const returnedUnpaid = vnpayResult === "failed" || vnpayResult === "invalid";
  // Polling window: starts on mount and again on "Check again"; a timer ends it so the
  // page switches state even when repeated polls return identical data.
  const [pollStartedAt, setPollStartedAt] = useState(() => Date.now());
  const [pollExpired, setPollExpired] = useState(false);
  const status = useQuery({
    queryKey: ["payment-status", orderId],
    queryFn: ({ signal }) => orderApi.paymentStatus(orderId!, signal),
    enabled: Boolean(orderId) && hasToken,
    retry: false,
    refetchInterval: (query) => {
      const payment = query.state.data?.data;
      return payment && awaitingConfirmation(payment) && !pollExpired && !returnedUnpaid
        ? POLL_INTERVAL_MS
        : false;
    },
  });
  const awaiting = status.data ? awaitingConfirmation(status.data.data) : false;
  useEffect(() => {
    if (!awaiting || pollExpired || returnedUnpaid) return;
    const timer = setTimeout(
      () => setPollExpired(true),
      Math.max(0, pollStartedAt + POLL_LIMIT_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [awaiting, pollExpired, pollStartedAt, returnedUnpaid]);
  const [redirecting, setRedirecting] = useState(false);
  const [retryError, setRetryError] = useState("");
  const retry = useMutation({
    mutationFn: (id: string) => orderApi.createVnpayPayment(id),
    onMutate: () => setRetryError(""),
    onSuccess: (response) => {
      const opened = openVnpayPage(response.data.redirect_url);
      setRedirecting(opened);
      if (!opened) setRetryError("The VNPay payment page could not be opened.");
    },
    onError: (failure) =>
      setRetryError(failure instanceof Error ? failure.message : "Could not start the payment."),
  });

  const heading = (
    <h1 className="font-display text-2xl font-semibold">
      {orderId ? `Payment for order #${orderId}` : "Payment result"}
    </h1>
  );
  const ordersLink = (
    <Button asChild variant="outline" className="min-h-11">
      <Link to="/dashboard">View your orders</Link>
    </Button>
  );
  const retryErrorText = retryError ? (
    <p role="alert" className="text-sm text-destructive">
      {retryError}
    </p>
  ) : null;
  const retryButton = (id: string) => (
    <Button
      className="min-h-11"
      disabled={retry.isPending || redirecting}
      onClick={() => retry.mutate(id)}
    >
      {retry.isPending || redirecting ? "Opening VNPay…" : "Try payment again"}
    </Button>
  );

  if (!orderId) {
    return (
      <section className="space-y-4">
        {heading}
        <p className="text-sm text-muted-foreground">
          This link does not include an order. Open your orders to check the payment.
        </p>
        {ordersLink}
      </section>
    );
  }

  const failure = status.error instanceof ApiError ? status.error : null;
  if (!hasToken || failure?.status === 401 || failure?.status === 403) {
    return (
      <section className="space-y-4">
        {heading}
        <p role="alert" className="text-sm text-destructive">
          Sign in with the customer account that placed this order to see its payment.
        </p>
        <Button asChild className="min-h-11">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </section>
    );
  }

  if (status.isPending) {
    return (
      <section className="space-y-4">
        {heading}
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          Checking your payment…
        </p>
      </section>
    );
  }

  if (status.isError) {
    const notFound = failure?.status === 404;
    return (
      <section className="space-y-4">
        {heading}
        <p role="alert" className="text-sm text-destructive">
          {notFound
            ? "This order was not found in your account."
            : "Could not check your payment. Check your connection and try again."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!notFound && (
            <Button
              className="min-h-11"
              disabled={status.isFetching}
              onClick={() => void status.refetch()}
            >
              {status.isFetching ? "Checking…" : "Try again"}
            </Button>
          )}
          {ordersLink}
        </div>
      </section>
    );
  }

  const payment = status.data.data;
  const total = <span className="tabular-nums">{money.format(payment.total_amount)}</span>;

  if (payment.payment_status === "PAID") {
    return (
      <section className="space-y-4">
        {heading}
        <Alert variant="success" role="status">
          <AlertDescription>
            <p className="font-medium">Payment received</p>
            VNPay confirmed your payment of {total}. The kitchen will confirm your order next.
          </AlertDescription>
        </Alert>
        {ordersLink}
      </section>
    );
  }

  if (awaitingConfirmation(payment) && returnedUnpaid) {
    return (
      <section className="space-y-4">
        {heading}
        <Alert variant="destructive" role="status">
          <AlertDescription>
            <p className="font-medium">Payment wasn’t completed on VNPay</p>
            Your order of {total} is kept and has not been paid yet.
          </AlertDescription>
        </Alert>
        {retryErrorText}
        {payment.can_retry && <div>{retryButton(payment.order_id)}</div>}
        <p className="text-sm text-muted-foreground">
          If you did pay, confirmation may still arrive.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            {status.isFetching ? "Checking…" : "Check again"}
          </Button>
          {ordersLink}
        </div>
      </section>
    );
  }

  if (awaitingConfirmation(payment)) {
    return (
      <section className="space-y-4">
        {heading}
        {!pollExpired ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
            Waiting for VNPay to confirm your payment of {total}…
          </p>
        ) : (
          <>
            <p role="status" className="text-sm text-muted-foreground">
              VNPay has not confirmed this payment yet. If you completed it, confirmation can take a
              few minutes.
            </p>
            <Button
              className="min-h-11"
              disabled={status.isFetching}
              onClick={() => {
                setPollStartedAt(Date.now());
                setPollExpired(false);
                void status.refetch();
              }}
            >
              {status.isFetching ? "Checking…" : "Check again"}
            </Button>
          </>
        )}
        {ordersLink}
      </section>
    );
  }

  if (payment.payment_status === "FAILED") {
    return (
      <section className="space-y-4">
        {heading}
        <Alert variant="destructive" role="status">
          <AlertDescription>
            <p className="font-medium">Payment was not completed</p>
            VNPay did not take your payment of {total}. Your order is kept; you can pay again.
          </AlertDescription>
        </Alert>
        {retryErrorText}
        <div className="flex flex-wrap gap-2">
          {payment.can_retry && retryButton(payment.order_id)}
          {ordersLink}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {heading}
      <p className="text-sm text-muted-foreground">
        {payment.order_status === "CANCELLED"
          ? "This order was cancelled."
          : "This order is not paid online."}
      </p>
      {ordersLink}
    </section>
  );
}
