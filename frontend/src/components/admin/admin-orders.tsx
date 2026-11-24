import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminOrderDetailsSchema,
  adminOrderStatusSchema,
  adminOrdersSchema,
  api,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageControls, SectionError } from "./customer-ui";
import {
  formatOrderAmount,
  formatOrderDate,
  orderStatusLabel,
  orderStatusVariant,
} from "./order-ui";

const ordersKey = ["admin", "orders"] as const;
const pageSize = 10;

export function AdminOrders() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (query.trim() === search) return;
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
  const list = useQuery({
    queryKey: [...ordersKey, "list", search, page],
    queryFn: ({ signal }) =>
      api(
        `/admin/orders?${new URLSearchParams({ search, page: String(page), page_size: String(pageSize) })}`,
        adminOrdersSchema,
        { signal },
      ),
    retry: false,
  });
  const result = list.data;
  useEffect(() => {
    if (result && page > 1 && !result.data.length) {
      setPage(Math.max(1, Math.ceil(result.pagination.total / pageSize)));
    }
  }, [result, page]);

  return (
    <section
      aria-labelledby="orders-title"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-4 sm:p-5">
        <h2 id="orders-title" className="font-semibold">
          All orders
        </h2>
        <div className="w-full space-y-2 sm:w-64">
          <Label htmlFor="order-search">Search orders</Label>
          <Input
            id="order-search"
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order ID, name or email"
            className="h-11"
          />
        </div>
      </div>
      {list.isError && (
        <div className="p-4">
          <SectionError
            message={`Could not load orders. ${list.error.message}`}
            retry={() => void list.refetch()}
          />
        </div>
      )}
      {list.isPending && (
        <p role="status" className="p-4 text-muted-foreground">
          Loading orders…
        </p>
      )}
      {result &&
        (result.data.length === 0 ? (
          <p className="p-4 text-muted-foreground">
            {search ? "No matching orders." : "No orders yet."}
          </p>
        ) : (
          <>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground sm:hidden">
              Scroll across for totals and delivery dates.
            </p>
            <div
              role="region"
              aria-label="Order list"
              tabIndex={0}
              className="overflow-x-auto [&>div]:overflow-visible"
            >
              <Table className="min-w-[42rem] max-sm:table-fixed" aria-label="All orders">
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead scope="col" className="max-sm:w-20">
                      Order ID
                    </TableHead>
                    <TableHead scope="col" className="max-sm:w-28">
                      Customer
                    </TableHead>
                    <TableHead scope="col" className="max-sm:w-26">
                      Status
                    </TableHead>
                    <TableHead scope="col" className="max-sm:w-32">
                      Total
                    </TableHead>
                    <TableHead scope="col">Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="max-sm:break-all">
                        <OrderDetailsButton id={order.id} />
                      </TableCell>
                      <TableCell className="max-w-64 break-words sm:min-w-36">
                        <p>{order.customer_name ?? "Unknown customer"}</p>
                        {order.created_at && (
                          <p className="text-xs text-muted-foreground">
                            {formatOrderDate(order.created_at)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={orderStatusVariant(order.status)}>
                          {orderStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatOrderAmount(order.total_amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p>{formatOrderDate(order.delivery_date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.delivery_time_slot ?? "No time slot"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-border px-4">
              <PageControls
                page={page}
                total={result.pagination.total}
                size={pageSize}
                onChange={setPage}
                pending={list.isFetching}
              />
            </div>
          </>
        ))}
    </section>
  );
}

function OrderDetailsButton({ id }: { id: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11 max-sm:h-auto max-sm:max-w-full max-sm:whitespace-normal max-sm:px-2"
          aria-label={`View order #${id}`}
        >
          #{id}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order #{id}</DialogTitle>
          <DialogDescription>Delivery, payment and meal details.</DialogDescription>
        </DialogHeader>
        <OrderDetails id={id} />
      </DialogContent>
    </Dialog>
  );
}

function OrderDetails({ id }: { id: string }) {
  const client = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const details = useQuery({
    queryKey: [...ordersKey, "details", id],
    queryFn: ({ signal }) => api(`/admin/orders/${id}`, adminOrderDetailsSchema, { signal }),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (payload: { expected_status: string; status: string }) =>
      api(`/admin/orders/${id}/status`, adminOrderStatusSchema, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => setNextStatus(""),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ordersKey }),
        client.invalidateQueries({ queryKey: ["admin", "overview"] }),
        client.invalidateQueries({ queryKey: ["admin", "profile"] }),
      ]);
    },
  });
  if (details.isPending) return <p role="status">Loading order…</p>;
  if (details.isError) {
    return (
      <SectionError
        message={`Could not load order. ${details.error.message}`}
        retry={() => void details.refetch()}
      />
    );
  }

  const order = details.data.data;
  const selectedStatus = order.next_statuses.find((status) => status === nextStatus) ?? "";

  return (
    <div className="space-y-4 break-words text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{order.customer_name ?? "Unknown customer"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={orderStatusVariant(order.status)}>
              {orderStatusLabel(order.status)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delivery</dt>
          <dd>
            {formatOrderDate(order.delivery_date)} · {order.delivery_time_slot ?? "No time slot"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment</dt>
          <dd>
            {order.payment_method} · {orderStatusLabel(order.payment_status)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Delivery address</dt>
          <dd>
            {[order.recipient_name, order.address_detail].filter(Boolean).join(" · ") ||
              "Unavailable"}
          </dd>
        </div>
      </dl>
      {order.next_statuses.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (order.status && selectedStatus && !update.isPending) {
              update.mutate({ expected_status: order.status, status: selectedStatus });
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="next-order-status">Next status</Label>
            <Select
              value={selectedStatus}
              onValueChange={setNextStatus}
              disabled={update.isPending}
            >
              <SelectTrigger id="next-order-status" className="h-11 w-40">
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent>
                {order.next_statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {orderStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="min-h-11"
            variant={selectedStatus === "CANCELLED" ? "destructive" : "default"}
            disabled={!selectedStatus || update.isPending}
          >
            {update.isPending
              ? "Saving…"
              : selectedStatus === "CANCELLED"
                ? "Cancel order"
                : "Update status"}
          </Button>
        </form>
      )}
      {update.isError && (
        <Alert variant="destructive">
          <AlertDescription>{update.error.message}</AlertDescription>
        </Alert>
      )}
      {update.isSuccess && (
        <p role="status" className="text-success">
          Order status updated.
        </p>
      )}
      <div className="border-t border-border pt-3">
        <h3 className="font-semibold">Meals</h3>
        {order.items.length === 0 && (
          <p className="mt-2 text-muted-foreground">No meal details recorded.</p>
        )}
        <ul className="divide-y divide-border">
          {order.items.map((item) => {
            const options = describeOptions(item.options);
            return (
              <li key={item.id} className="flex justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p>
                    {item.name} × {item.quantity}
                  </p>
                  {options && <p className="text-muted-foreground">{options}</p>}
                </div>
                <p className="shrink-0 tabular-nums">
                  {formatOrderAmount(Number(item.unit_price) * item.quantity)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <dl className="space-y-1 border-t border-border pt-3 tabular-nums">
        {order.shipping_fee !== null && (
          <div className="flex justify-between">
            <dt>Shipping fee</dt>
            <dd>{formatOrderAmount(order.shipping_fee)}</dd>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd>{formatOrderAmount(order.total_amount)}</dd>
        </div>
      </dl>
    </div>
  );
}

function describeOptions(options: unknown) {
  if (Array.isArray(options)) {
    return options
      .map((option) => (typeof option?.name === "string" ? option.name : ""))
      .filter(Boolean)
      .join(" · ");
  }
  if (!options || typeof options !== "object") return "";
  return Object.entries(options)
    .filter(([, value]) => typeof value === "string" && value)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
    .join(" · ");
}
