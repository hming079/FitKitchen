import { useQuery } from "@tanstack/react-query";
import { orderApi } from "@/lib/order-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
}

export function CustomerOrders() {
  const orders = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: ({ signal }) => orderApi.orders(signal),
    retry: false,
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
          {orders.data.data.map((order) => (
            <li
              key={order.id}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  Order #{order.id}{" "}
                  <Badge variant={statusVariant(order.status)} className="ml-2 align-middle">
                    {order.status.toLowerCase()}
                  </Badge>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Delivery {dates.format(new Date(`${order.delivery_date}T00:00:00Z`))} · Cash on
                  delivery
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {money.format(order.total_amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
