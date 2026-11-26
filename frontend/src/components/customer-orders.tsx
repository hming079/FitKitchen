import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { canPayOnline, openVnpayPage, orderApi, type Order } from "@/lib/order-api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const dates = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

type PaymentFields = Pick<Order, "payment_method" | "payment_status">;

function paymentMethodText(order: PaymentFields) {
  return order.payment_method === "ONLINE" ? "VNPay" : "Cash on delivery";
}

// Online payment state is a status worth scanning, so it is a badge; COD stays plain text.
function PaymentBadge({ order, className }: { order: PaymentFields; className?: string }) {
  if (order.payment_method !== "ONLINE") return null;
  if (order.payment_status === "PAID")
    return (
      <Badge variant="success" className={className}>
        Paid
      </Badge>
    );
  if (order.payment_status === "FAILED")
    return (
      <Badge variant="destructive" className={className}>
        Payment failed
      </Badge>
    );
  return (
    <Badge variant="warning" className={className}>
      Payment pending
    </Badge>
  );
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
}

export function CustomerOrders() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: ({ signal }) => orderApi.orders(signal),
    retry: false,
  });
  const order = useQuery({
    queryKey: ["customer", "order", selectedOrderId],
    queryFn: ({ signal }) => orderApi.order(selectedOrderId!, signal),
    enabled: selectedOrderId !== null,
    retry: false,
  });
  const [redirectingId, setRedirectingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<{ orderId: string; message: string } | null>(null);
  const payNow = useMutation({
    mutationFn: (orderId: string) => orderApi.createVnpayPayment(orderId),
    onMutate: () => setPayError(null),
    onSuccess: (response, orderId) => {
      if (openVnpayPage(response.data.redirect_url)) setRedirectingId(orderId);
      else setPayError({ orderId, message: "The VNPay payment page could not be opened." });
    },
    onError: (failure, orderId) =>
      setPayError({
        orderId,
        message: failure instanceof Error ? failure.message : "Could not start the VNPay payment.",
      }),
  });
  const paying = (orderId: string) =>
    (payNow.isPending && payNow.variables === orderId) || redirectingId === orderId;
  // Lists keep one primary action per region, so rows use outline; the details dialog uses primary.
  const payButton = (orderId: string, className: string, variant: "default" | "outline") => (
    <Button
      variant={variant}
      className={className}
      disabled={payNow.isPending || redirectingId !== null}
      onClick={() => payNow.mutate(orderId)}
      aria-label={`Pay now for order ${orderId}`}
    >
      {paying(orderId) ? "Opening VNPay…" : "Pay now"}
    </Button>
  );
  const payErrorFor = (orderId: string) =>
    payError?.orderId === orderId ? (
      <p role="alert" className="text-sm text-destructive">
        {payError.message}
      </p>
    ) : null;
  const cancelOrder = useMutation({
    mutationFn: orderApi.cancelOrder,
    onSuccess: async (response) => {
      queryClient.setQueryData(["customer", "order", response.data.id], response);
      await queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      setCancelTarget(null);
    },
  });

  return (
    <section
      aria-labelledby="customer-orders-title"
      className="mt-9 border-y border-border py-6 sm:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="customer-orders-title" className="font-display text-2xl font-bold">
            Your orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery status and recent purchases.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={orders.isFetching}
          onClick={() => void orders.refetch()}
        >
          {orders.isFetching ? "Refreshing…" : "Refresh orders"}
        </Button>
      </div>
      {orders.isPending ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Loading your orders…
        </p>
      ) : orders.isError ? (
        <div className="mt-4 space-y-2">
          <p role="alert" className="text-sm text-destructive">
            Could not load your order history.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => void orders.refetch()}>
            Try again
          </Button>
        </div>
      ) : orders.data.data.length === 0 ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          You haven’t placed an order yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {orders.data.data.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  Order #{item.id}{" "}
                  <Badge variant={statusVariant(item.status)} className="ml-2 align-middle">
                    {humanStatus(item.status)}
                  </Badge>
                  <PaymentBadge order={item} className="ml-2 align-middle" />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Delivery {dates.format(new Date(`${item.delivery_date}T00:00:00Z`))} ·{" "}
                  {paymentMethodText(item)}
                </p>
                {item.items_summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {item.items_summary}
                  </p>
                )}
                {payErrorFor(item.id)}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end">
                <p className="font-semibold tabular-nums">{money.format(item.total_amount)}</p>
                {canPayOnline(item) && payButton(item.id, "min-h-10", "outline")}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-10"
                  onClick={() => {
                    cancelOrder.reset();
                    setSelectedOrderId(item.id);
                  }}
                  aria-label={`View details for order ${item.id}`}
                >
                  View details <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={selectedOrderId !== null}
        onOpenChange={(open) => {
          if (!open && !cancelOrder.isPending) setSelectedOrderId(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Order #{selectedOrderId}</DialogTitle>
            <DialogDescription>Order details and delivery status.</DialogDescription>
          </DialogHeader>
          {order.isPending ? (
            <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              Loading order details…
            </p>
          ) : order.isError ? (
            <div className="space-y-2 py-4">
              <p role="alert" className="text-sm text-destructive">
                Could not load this order.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => void order.refetch()}>
                Try again
              </Button>
            </div>
          ) : order.data ? (
            <OrderDetails order={order.data.data} />
          ) : null}
          {cancelOrder.isError && (
            <p role="alert" className="text-sm text-destructive">
              {cancelOrder.error instanceof Error
                ? cancelOrder.error.message
                : "Could not cancel this order. Refresh and try again."}
            </p>
          )}
          {order.data && payErrorFor(order.data.data.id)}
          <DialogFooter>
            {order.data &&
              canPayOnline(order.data.data) &&
              payButton(order.data.data.id, "min-h-11", "default")}
            {order.data?.data.status === "PENDING" &&
              // Paid online orders have no refund flow; the backend rejects self-cancellation.
              !(
                order.data.data.payment_method === "ONLINE" &&
                order.data.data.payment_status === "PAID"
              ) && (
                <Button
                  variant="destructive"
                  className="min-h-11"
                  disabled={cancelOrder.isPending}
                  onClick={() => setCancelTarget(order.data!.data.id)}
                >
                  Cancel order
                </Button>
              )}
            <Button
              variant="outline"
              className="min-h-11"
              disabled={cancelOrder.isPending}
              onClick={() => setSelectedOrderId(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{cancelTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only pending orders can be cancelled. This order will be removed from preparation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelOrder.isPending}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelOrder.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) cancelOrder.mutate(cancelTarget);
              }}
            >
              {cancelOrder.isPending ? "Cancelling…" : "Confirm cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <Badge variant={statusVariant(order.status)}>{humanStatus(order.status)}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delivery date</dt>
          <dd className="mt-1 font-medium">
            {dates.format(new Date(`${order.delivery_date}T00:00:00Z`))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium">
            {paymentMethodText(order)}
            <PaymentBadge order={order} />
          </dd>
        </div>
      </dl>
      <section aria-label="Ordered meals">
        <h3 className="text-sm font-semibold">Meals</h3>
        {order.items?.length ? (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {order.items.map((item) => (
              <li
                key={item.id ?? `${item.meal_id}-${item.name}`}
                className="flex justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    {item.name} × {item.quantity}
                  </p>
                  {item.options?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.options.map(({ name }) => name).join(", ")}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium tabular-nums">
                  {money.format(item.unit_price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No meal details are available.</p>
        )}
      </section>
      <div className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{money.format(order.total_amount)}</span>
      </div>
    </div>
  );
}
