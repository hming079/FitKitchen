import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminOverviewSchema, api } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionError } from "./customer-ui";
import {
  formatOrderAmount,
  formatOrderDate,
  orderStatusLabel,
  orderStatusVariant,
} from "./order-ui";

type RangePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_6_months"
  | "custom";
type GroupBy = "day" | "month";

const ranges: Record<RangePreset, string> = {
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  last_6_months: "Last 6 months",
  custom: "Custom range",
};

function calendarToday() {
  return new Date().toLocaleDateString("sv-SE");
}

function sixMonthsAgoStart() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return start.toLocaleDateString("sv-SE");
}

function formatSeriesTick(date: string, groupBy: GroupBy) {
  if (groupBy === "month") return `${date.slice(5, 7)}/${date.slice(0, 4)}`;
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function formatSeriesAriaDate(date: string, groupBy: GroupBy) {
  if (groupBy === "month") return date.slice(0, 7);
  return formatOrderDate(date);
}

export function AdminOverview({ onOrders }: { onOrders: () => void }) {
  const [range, setRange] = useState<RangePreset>("this_week");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [customStart, setCustomStart] = useState(sixMonthsAgoStart);
  const [customEnd, setCustomEnd] = useState(calendarToday);

  const rangeValidation = useMemo(() => {
    if (range !== "custom") return null;
    if (!customStart || !customEnd) return "Choose both start and end dates.";
    if (customEnd < customStart) return "End date must be on or after start date.";
    const days =
      Math.floor(
        (new Date(`${customEnd}T00:00:00Z`).valueOf() -
          new Date(`${customStart}T00:00:00Z`).valueOf()) /
          86400000,
      ) + 1;
    if (groupBy === "day" && days > 366) {
      return "Daily view supports up to 366 days. Switch Group by to Monthly for longer ranges.";
    }
    if (groupBy === "month" && days > 1830) {
      return "Date range must not exceed 5 years.";
    }
    return null;
  }, [range, groupBy, customStart, customEnd]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ group_by: groupBy, top_limit: "5" });
    if (range === "last_6_months") {
      params.set("start_date", sixMonthsAgoStart());
      params.set("end_date", calendarToday());
    } else if (range === "custom") {
      params.set("start_date", customStart);
      params.set("end_date", customEnd);
    } else {
      params.set("range", range);
    }
    return params.toString();
  }, [range, groupBy, customStart, customEnd]);

  const overview = useQuery({
    queryKey: ["admin", "overview", queryParams],
    queryFn: ({ signal }) => api(`/admin/overview?${queryParams}`, adminOverviewSchema, { signal }),
    enabled: rangeValidation === null,
    retry: false,
  });

  const summary = overview.data?.data;
  const activeGroupBy = summary?.group_by ?? groupBy;
  const topMeals = summary?.top_meals ?? (summary?.top_meal ? [summary.top_meal] : []);
  const periodLabel =
    summary?.period_start && summary?.period_end
      ? `${formatOrderDate(summary.period_start)} – ${formatOrderDate(summary.period_end)}`
      : ranges[range];

  const stats = summary && [
    {
      title: "Daily revenue",
      value: formatOrderAmount(summary.daily_revenue),
      note: `Yesterday: ${formatOrderAmount(summary.previous_daily_revenue)}`,
    },
    {
      title: "Period revenue",
      value: formatOrderAmount(summary.period_revenue),
      note: periodLabel,
    },
    { title: "Pending orders", value: summary.pending_orders },
    { title: "Active subscriptions", value: summary.active_subscriptions },
    {
      title: "Subscription renewal rate",
      value: summary.renewal_rate === null ? "No ended subscribers" : `${summary.renewal_rate}%`,
      note:
        summary.renewal_rate === null
          ? "No paid subscriptions ended in this period."
          : `${summary.renewed_customers} of ${summary.renewal_eligible_customers} ended customers · new paid plan within 7 days`,
      progress: summary.renewal_rate === null ? null : Number(summary.renewal_rate),
    },
    {
      title: "Top meal",
      value: summary.top_meal?.name ?? "No meals ordered",
      note:
        summary.top_meal &&
        `${summary.top_meal.quantity} ${summary.top_meal.quantity === 1 ? "serving" : "servings"} · ${summary.top_meal.order_count} ${summary.top_meal.order_count === 1 ? "order" : "orders"}${summary.top_meal.revenue ? ` · ${formatOrderAmount(summary.top_meal.revenue)}` : ""}`,
    },
    { title: "Order deliveries today", value: summary.deliveries_today },
    {
      title: "Average order value",
      value:
        summary.average_order_value === null
          ? "No paid orders"
          : formatOrderAmount(summary.average_order_value),
      note: ranges[range],
    },
  ];

  const chartMax = Math.max(
    0,
    ...(summary?.revenue_series.map((point) => Number(point.revenue)) ?? []),
  );

  function handleRangeChange(next: string) {
    const preset = next as RangePreset;
    setRange(preset);
    if (preset === "last_6_months") {
      setGroupBy("month");
    } else if (preset === "this_week" || preset === "last_week") {
      setGroupBy("day");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sales-range">Sales period</Label>
          <Select value={range} onValueChange={handleRangeChange}>
            <SelectTrigger id="sales-range" className="h-11 w-44">
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
        <div className="space-y-1.5">
          <Label htmlFor="sales-group-by">Group by</Label>
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
            <SelectTrigger id="sales-group-by" className="h-11 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {range === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sales-start-date">From</Label>
              <Input
                id="sales-start-date"
                type="date"
                className="h-11 w-40 text-base"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sales-end-date">To</Label>
              <Input
                id="sales-end-date"
                type="date"
                className="h-11 w-40 text-base"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          </>
        )}
      </div>
      {rangeValidation && (
        <p role="alert" className="text-sm text-destructive">
          {rangeValidation}
        </p>
      )}
      {rangeValidation === null && overview.isError && (
        <SectionError
          message={`Could not load overview. ${overview.error.message}`}
          retry={() => void overview.refetch()}
        />
      )}
      {rangeValidation === null && overview.isPending && (
        <p role="status" className="text-muted-foreground">
          Loading overview…
        </p>
      )}
      {summary && stats && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {stats.map(({ title, value, note, progress }) => (
              <div
                key={title}
                className="min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-5"
              >
                <dt className="text-sm text-muted-foreground">{title}</dt>
                <dd className="mt-1 break-words font-display text-xl font-semibold tabular-nums">
                  {value}
                </dd>
                {progress !== undefined && progress !== null && (
                  <dd className="mt-2">
                    <Progress
                      value={Math.min(100, Math.max(0, progress))}
                      aria-label={title}
                      className="h-2"
                    />
                  </dd>
                )}
                {note && <dd className="mt-1 text-sm text-muted-foreground">{note}</dd>}
              </div>
            ))}
          </dl>
          <section
            aria-labelledby="sales-title"
            className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="sales-title" className="font-semibold">
                  Sales overview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeGroupBy === "month"
                    ? "Paid orders grouped by month"
                    : "Paid orders grouped by day"}
                </p>
              </div>
              <p className="text-sm">
                Period total{" "}
                <strong className="tabular-nums">
                  {formatOrderAmount(summary.period_revenue)}
                </strong>
              </p>
            </div>
            {chartMax === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No revenue in this period.</p>
            ) : (
              <div
                className="mt-4 overflow-x-auto"
                role="region"
                aria-label={
                  activeGroupBy === "month" ? "Monthly revenue chart" : "Daily revenue chart"
                }
                tabIndex={0}
              >
                <ol className="flex min-w-max gap-2">
                  {summary.revenue_series.map(({ date, revenue, orders }) => {
                    const numericRevenue = Math.max(0, Number(revenue));
                    const heightPct = (numericRevenue / chartMax) * 100;
                    return (
                      <li key={date} className="min-w-16 flex-1 text-center text-xs">
                        <div
                          aria-hidden="true"
                          className="flex h-36 items-end justify-center border-b border-border"
                        >
                          <div
                            className={`w-6 rounded-t-sm bg-primary ${numericRevenue > 0 ? "min-h-1" : ""}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span aria-hidden="true" className="mt-1 block text-muted-foreground">
                          {formatSeriesTick(date, activeGroupBy)}
                        </span>
                        <span aria-hidden="true" className="block px-1 font-medium tabular-nums">
                          {formatOrderAmount(revenue)}
                        </span>
                        <span className="sr-only">
                          {formatSeriesAriaDate(date, activeGroupBy)}: {formatOrderAmount(revenue)}
                          {orders !== undefined ? `, ${orders} orders` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
          <div className="grid gap-5 xl:grid-cols-2">
            <section
              aria-labelledby="top-meals-title"
              className="min-w-0 rounded-lg border border-border bg-card text-card-foreground"
            >
              <div className="border-b border-border p-4 sm:px-5">
                <h2 id="top-meals-title" className="font-semibold">
                  Top selling meals
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paid orders in {periodLabel}, ranked by servings sold. Revenue is before discount
                  codes.
                </p>
              </div>
              {topMeals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:px-5">
                  No paid meal orders in this period.
                </p>
              ) : (
                <Table>
                  <TableCaption className="sr-only">
                    Top selling meals ranked by quantity sold and revenue
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead scope="col" className="w-12 pl-4 sm:pl-5">
                        Rank
                      </TableHead>
                      <TableHead scope="col">Meal</TableHead>
                      <TableHead scope="col" className="text-right">
                        Sold
                      </TableHead>
                      <TableHead scope="col" className="pr-4 text-right sm:pr-5">
                        Revenue
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topMeals.map((meal, index) => (
                      <TableRow key={meal.meal_id ?? `${meal.name}-${index}`}>
                        <TableCell className="pl-4 font-medium tabular-nums text-muted-foreground sm:pl-5">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="min-w-0 max-w-56 break-words">
                          <span className="block font-medium text-foreground">{meal.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {meal.order_count} {meal.order_count === 1 ? "order" : "orders"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {meal.quantity}
                        </TableCell>
                        <TableCell className="pr-4 text-right font-medium tabular-nums sm:pr-5">
                          {meal.revenue !== undefined ? formatOrderAmount(meal.revenue) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
            <section
              aria-labelledby="recent-orders-title"
              className="min-w-0 rounded-lg border border-border bg-card text-card-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 sm:px-5">
                <h2 id="recent-orders-title" className="font-semibold">
                  Recent orders
                </h2>
                <Button variant="outline" className="min-h-11" onClick={onOrders}>
                  View all orders
                </Button>
              </div>
              {summary.recent_orders.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:px-5">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {summary.recent_orders.map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-wrap justify-between gap-2 p-4 text-sm sm:px-5"
                    >
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
