import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminOverviewSchema, api } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionError } from "./customer-ui";
import {
  formatOrderAmount,
  formatOrderDate,
  orderStatusLabel,
  orderStatusVariant,
} from "./order-ui";

const ranges = {
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
};

export function AdminOverview({ onOrders }: { onOrders: () => void }) {
  const [range, setRange] = useState("this_week");
  const overview = useQuery({
    queryKey: ["admin", "overview", range],
    queryFn: ({ signal }) => api(`/admin/overview?range=${range}`, adminOverviewSchema, { signal }),
    retry: false,
  });
  const summary = overview.data?.data;
  const stats = summary && [
    {
      title: "Daily revenue",
      value: formatOrderAmount(summary.daily_revenue),
      note: `Yesterday: ${formatOrderAmount(summary.previous_daily_revenue)}`,
    },
    { title: "Pending orders", value: summary.pending_orders },
    { title: "Active subscriptions", value: summary.active_subscriptions },
    {
      title: "Top meal this week",
      value: summary.top_meal?.name ?? "No meals ordered",
      note:
        summary.top_meal &&
        `${summary.top_meal.quantity} ${summary.top_meal.quantity === 1 ? "serving" : "servings"} · ${summary.top_meal.order_count} ${summary.top_meal.order_count === 1 ? "order" : "orders"}`,
    },
    { title: "Order deliveries today", value: summary.deliveries_today },
    {
      title: "Average order value",
      value:
        summary.average_order_value === null
          ? "No paid orders"
          : formatOrderAmount(summary.average_order_value),
      note: ranges[range as keyof typeof ranges],
    },
  ];
  const chartMax = Math.max(
    0,
    ...(summary?.revenue_series.map((day) => Number(day.revenue)) ?? []),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="sales-range">Sales period</Label>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger id="sales-range" className="h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ranges).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {overview.isError && (
        <SectionError
          message={`Could not load overview. ${overview.error.message}`}
          retry={() => void overview.refetch()}
        />
      )}
      {overview.isPending && (
        <p role="status" className="text-muted-foreground">
          Loading overview…
        </p>
      )}
      {summary && stats && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {stats.map(({ title, value, note }) => (
              <div
                key={title}
                className="min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-5"
              >
                <dt className="text-sm text-muted-foreground">{title}</dt>
                <dd className="mt-1 break-words font-display text-xl font-semibold tabular-nums">
                  {value}
                </dd>
                {note && <dd className="mt-1 text-sm text-muted-foreground">{note}</dd>}
              </div>
            ))}
          </dl>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section
              aria-labelledby="sales-title"
              className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground"
            >
              <h2 id="sales-title" className="font-semibold">
                Sales overview
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Paid orders by order date</p>
              <p className="mt-4 text-sm">
                Period total{" "}
                <strong className="tabular-nums">
                  {formatOrderAmount(summary.period_revenue)}
                </strong>
              </p>
              {chartMax === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No revenue in this period.</p>
              ) : (
                <div
                  className="mt-4 overflow-x-auto"
                  role="region"
                  aria-label="Daily revenue chart"
                  tabIndex={0}
                >
                  <ol className="flex min-w-max gap-2">
                    {summary.revenue_series.map(({ date, revenue }) => (
                      <li key={date} className="min-w-14 flex-1 text-center text-xs">
                        <div
                          aria-hidden="true"
                          className="flex h-36 items-end justify-center border-b border-border"
                        >
                          <div
                            className="w-5 rounded-t-sm bg-primary"
                            style={{
                              height: `${(Math.max(0, Number(revenue)) / chartMax) * 100}%`,
                            }}
                          />
                        </div>
                        <span aria-hidden="true" className="mt-1 block text-muted-foreground">
                          {Number(date.slice(-2))}
                        </span>
                        <span aria-hidden="true" className="block px-1 font-medium tabular-nums">
                          {formatOrderAmount(revenue)}
                        </span>
                        <span className="sr-only">
                          {formatOrderDate(date)}: {formatOrderAmount(revenue)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
            <section
              aria-labelledby="recent-orders-title"
              className="min-w-0 rounded-lg border border-border bg-card text-card-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <h2 id="recent-orders-title" className="font-semibold">
                  Recent orders
                </h2>
                <Button variant="outline" onClick={onOrders}>
                  View all orders
                </Button>
              </div>
              {summary.recent_orders.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {summary.recent_orders.map((order) => (
                    <li key={order.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                      <div className="min-w-0 flex-1 break-words">
                        <p className="font-semibold">{order.customer_name ?? "Unknown customer"}</p>
                        <p className="text-muted-foreground">
                          #{order.id}
                          {order.created_at && ` · ${formatOrderDate(order.created_at)}`}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="font-semibold tabular-nums">
                          {formatOrderAmount(order.total_amount)}
                        </p>
                        <Badge variant={orderStatusVariant(order.status)}>
                          {orderStatusLabel(order.status)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
