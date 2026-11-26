import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/order-api";

// Shared order presentation for the customer order dialog and the payment result page.
export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
export const dates = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

type PaymentFields = Pick<Order, "payment_method" | "payment_status">;

export function paymentMethodText(order: PaymentFields) {
  return order.payment_method === "ONLINE" ? "VNPay" : "Cash on delivery";
}

// Online payment state is a status worth scanning, so it is a badge; COD stays plain text.
export function PaymentBadge({ order, className }: { order: PaymentFields; className?: string }) {
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

export function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
}

export function OrderDetails({ order }: { order: Order }) {
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
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="mt-1 font-medium">
            {dates.format(new Date(`${order.delivery_date}T00:00:00Z`))}
            {order.delivery_time_slot ? (
              <span className="block text-muted-foreground tabular-nums">
                {order.delivery_time_slot}
              </span>
            ) : null}
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
      <dl className="space-y-2 border-t border-border pt-3 text-sm">
        {order.subtotal_amount !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{money.format(order.subtotal_amount)}</dd>
          </div>
        )}
        {order.discount_amount !== undefined && order.discount_amount > 0 && (
          <div className="flex justify-between gap-3 text-success">
            <dt>
              Discount{order.promotion_code ? ` (${order.promotion_code})` : ""}
            </dt>
            <dd className="tabular-nums">−{money.format(order.discount_amount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money.format(order.total_amount)}</dd>
        </div>
      </dl>
    </div>
  );
}
