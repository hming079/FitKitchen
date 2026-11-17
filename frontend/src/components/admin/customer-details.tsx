import { useState } from "react";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  profileSchema,
  ordersSchema,
  subscriptionsSchema,
  type Customer,
} from "@/lib/admin-api";
import { AccountStatus, PageControls, SectionError } from "./customer-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Not recorded";
}
function calendarDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
function money(value: string) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;
}

export function CustomerDetails({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [orderPage, setOrderPage] = useState(1);
  const returnFocus = useDialogReturnFocus();
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const base = `/admin/customers/${customer.id}`;
  const profile = useQuery({
    queryKey: ["admin", "profile", customer.id],
    queryFn: ({ signal }) => api(base, profileSchema, { signal }),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["admin", "orders", customer.id, orderPage],
    queryFn: ({ signal }) =>
      api(`${base}/orders?page=${orderPage}&page_size=10`, ordersSchema, { signal }),
    retry: false,
  });
  const subscriptions = useQuery({
    queryKey: ["admin", "subscriptions", customer.id, subscriptionPage],
    queryFn: ({ signal }) =>
      api(`${base}/subscriptions?page=${subscriptionPage}&page_size=10`, subscriptionsSchema, {
        signal,
      }),
    retry: false,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={returnFocus}
        className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg motion-reduce:animate-none"
      >
        <DialogHeader>
          <DialogTitle className="pr-8">{customer.full_name}</DialogTitle>
          <DialogDescription>
            Contact details, order history and current service plans.
          </DialogDescription>
        </DialogHeader>
        <section className="space-y-3">
          <h3 className="font-semibold">Profile</h3>
          {profile.isPending ? (
            <p role="status">Loading profile…</p>
          ) : profile.isError ? (
            <SectionError message={profile.error.message} retry={() => void profile.refetch()} />
          ) : (
            <>
              <AccountStatus locked={profile.data.data.is_locked} />
              <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Email", profile.data.data.email],
                  ["Phone", profile.data.data.phone || "No phone"],
                  ["Fitness goal", profile.data.data.fitness_goal || "Not specified"],
                  ["Joined", date(profile.data.data.created_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
                  </div>
                ))}
              </dl>
              <h4 className="font-medium">Addresses</h4>
              {!profile.data.data.addresses.length ? (
                <p className="text-sm text-muted-foreground">No addresses.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {profile.data.data.addresses.map((address) => (
                    <li key={address.id} className="break-words">
                      <p className="font-medium">
                        {address.recipient_name}
                        {address.is_default ? " · Default" : ""}
                      </p>
                      <p>{address.phone}</p>
                      <p>{address.address_detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Order history</h3>
          {orders.isPending ? (
            <p role="status">Loading orders…</p>
          ) : orders.isError ? (
            <SectionError message={orders.error.message} retry={() => void orders.refetch()} />
          ) : (
            <>
              {!orders.data.data.length ? (
                <p className="text-sm text-muted-foreground">No orders.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.data.data.map((order) => (
                    <li key={order.id} className="space-y-2 py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium">Order #{order.id}</span>
                        <span>{order.status || "Status unavailable"}</span>
                      </div>
                      <p>
                        Ordered {date(order.created_at)} · Delivery{" "}
                        {calendarDate(order.delivery_date)}
                      </p>
                      <p className="tabular-nums">
                        {money(order.total_amount)} · {order.payment_method} ·{" "}
                        {order.payment_status || "Payment status unavailable"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <PageControls
                page={orderPage}
                total={orders.data.pagination.total}
                size={10}
                onChange={setOrderPage}
                pending={orders.isFetching}
              />
            </>
          )}
        </section>
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Current service plans</h3>
          {subscriptions.isPending ? (
            <p role="status">Loading plans…</p>
          ) : subscriptions.isError ? (
            <SectionError
              message={subscriptions.error.message}
              retry={() => void subscriptions.refetch()}
            />
          ) : (
            <>
              {!subscriptions.data.data.length ? (
                <p className="text-sm text-muted-foreground">No current service plans.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {subscriptions.data.data.map((plan) => (
                    <li key={plan.id} className="space-y-1">
                      <p className="break-words font-medium">
                        {plan.plan_name} · {plan.status}
                      </p>
                      <p>
                        {calendarDate(plan.start_date)} – {calendarDate(plan.end_date)}
                      </p>
                      <p className="tabular-nums">
                        {money(plan.total_amount)} · {plan.payment_method} ·{" "}
                        {plan.payment_status || "Payment status unavailable"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <PageControls
                page={subscriptionPage}
                total={subscriptions.data.pagination.total}
                size={10}
                onChange={setSubscriptionPage}
                pending={subscriptions.isFetching}
              />
            </>
          )}
        </section>
        <Button variant="outline" className="min-h-11" onClick={onClose}>
          Close profile
        </Button>
      </DialogContent>
    </Dialog>
  );
}
