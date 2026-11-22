import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Plus, Trash2 } from "lucide-react";
import { PageControls, SectionError } from "@/components/admin/customer-ui";
import {
  optionalText,
  salesAction,
  textField,
  vnd,
  type CatalogAction,
} from "@/components/admin/catalog/catalog-data";
import {
  AvailableField,
  CatalogConfirm,
  CatalogForm,
  DescriptionField,
} from "@/components/admin/catalog/catalog-dialogs";
import {
  AvailabilityBadge,
  CatalogInput,
  CatalogSelect,
  CatalogTable,
} from "@/components/admin/catalog/catalog-ui";
import { SubscriptionPhaseBadge } from "@/components/subscription-plans";
import { catalogApi } from "@/lib/catalog-api";
import {
  adminSubscriptionsKey,
  formatCalendarDate,
  subscriptionApi,
  type AdminSubscription,
  type AdminSubscriptionPlan,
  type AdminSubscriptionView,
  type GiftInput,
} from "@/lib/subscription-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const viewChoices: readonly { value: AdminSubscriptionView; label: string }[] = [
  { value: "all", label: "All subscriptions" },
  { value: "in_progress", label: "Active (in progress)" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Pending confirmation" },
  { value: "ended", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type EditableGift = GiftInput & { key: string };

function PlanEditor({
  plan,
  onClose,
}: {
  plan?: AdminSubscriptionPlan | undefined;
  onClose: () => void;
}) {
  const [gifts, setGifts] = useState<EditableGift[]>(() =>
    (plan?.gifts ?? []).map((gift, index) => ({
      key: `${gift.id}-${index}`,
      product_id: gift.product_id,
      gift_name: gift.gift_name,
      description: gift.description,
      quantity: gift.quantity,
    })),
  );

  const productsQuery = useQuery({
    queryKey: ["admin", "catalog", "products", "gift-picker"],
    queryFn: ({ signal }) =>
      catalogApi.listProducts({ available: "true", page: 1, page_size: 100 }, signal),
    retry: false,
  });
  const products = productsQuery.data?.data ?? [];

  function addGiftRow() {
    setGifts((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${current.length}`,
        product_id: null,
        gift_name: "",
        description: null,
        quantity: 1,
      },
    ]);
  }

  function updateGiftRow(key: string, patch: Partial<GiftInput>) {
    setGifts((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeGiftRow(key: string) {
    setGifts((current) => current.filter((item) => item.key !== key));
  }

  return (
    <CatalogForm
      title={plan ? "Edit subscription plan" : "Create subscription plan"}
      description={
        plan
          ? plan.name
          : "Configure duration (e.g. 7 or 30 days), daily meals, price, and bundled gifts."
      }
      active={plan?.is_active === true}
      submitLabel={plan ? "Save changes" : "Create plan"}
      success={plan ? "Subscription plan updated." : "Subscription plan created."}
      queryKey={adminSubscriptionsKey}
      onClose={onClose}
      save={(form) => {
        const cleanedGifts: GiftInput[] = gifts.map((g) => ({
          product_id: g.product_id,
          gift_name: g.gift_name.trim(),
          description: g.description?.trim() ? g.description.trim() : null,
          quantity: Number(g.quantity) || 1,
        }));
        if (cleanedGifts.some((g) => !g.gift_name)) {
          return Promise.reject(new Error("Each gift must have a gift name."));
        }
        const payload = {
          name: textField(form, "name").trim(),
          description: optionalText(form, "description"),
          duration_days: Number(textField(form, "duration_days")),
          meals_per_day: Number(textField(form, "meals_per_day")),
          price: Number(textField(form, "price")),
          is_active: form.has("is_available"),
          gifts: cleanedGifts,
        };
        return plan
          ? subscriptionApi.updateAdminPlan(plan.id, payload)
          : subscriptionApi.createAdminPlan(payload);
      }}
    >
      {() => (
        <>
          <CatalogInput
            label="Plan name"
            name="name"
            required
            maxLength={200}
            pattern=".*\S.*"
            defaultValue={plan?.name ?? ""}
            placeholder="e.g. Gói Eat Clean 7 ngày"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <CatalogInput
              label="Duration (days)"
              name="duration_days"
              type="number"
              min={1}
              max={365}
              step={1}
              required
              defaultValue={plan?.duration_days ?? 7}
            />
            <CatalogInput
              label="Meals per day"
              name="meals_per_day"
              type="number"
              min={1}
              max={6}
              step={1}
              required
              defaultValue={plan?.meals_per_day ?? 2}
            />
            <CatalogInput
              label="Price (VND)"
              name="price"
              type="number"
              min={0}
              max={9999999999.99}
              step={0.01}
              required
              defaultValue={plan?.price ?? 850000}
            />
          </div>
          <DescriptionField value={plan?.description} />

          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Gift className="size-4 text-primary" aria-hidden />
                  Bundled plan gifts ({gifts.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  Gifts are automatically copied to the customer’s subscription at checkout.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 gap-1"
                disabled={gifts.length >= 10}
                onClick={addGiftRow}
              >
                <Plus className="size-3.5" aria-hidden />
                Add gift
              </Button>
            </div>

            {gifts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No gifts attached to this plan yet.</p>
            ) : (
              <div className="space-y-3">
                {gifts.map((gift, index) => (
                  <div
                    key={gift.key}
                    className="space-y-2.5 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Gift #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        aria-label={`Remove gift ${index + 1}`}
                        onClick={() => removeGiftRow(gift.key)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-[1fr_5.5rem]">
                      <div className="space-y-1">
                        <Label htmlFor={`gift-name-${gift.key}`} className="text-xs">
                          Gift name
                        </Label>
                        <Input
                          id={`gift-name-${gift.key}`}
                          required
                          maxLength={200}
                          value={gift.gift_name}
                          placeholder="e.g. Tặng 2 thanh protein hạt điều"
                          onChange={(e) => updateGiftRow(gift.key, { gift_name: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`gift-qty-${gift.key}`} className="text-xs">
                          Quantity
                        </Label>
                        <Input
                          id={`gift-qty-${gift.key}`}
                          type="number"
                          min={1}
                          max={100}
                          required
                          value={gift.quantity}
                          onChange={(e) =>
                            updateGiftRow(gift.key, { quantity: Number(e.target.value) || 1 })
                          }
                          className="h-10"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`gift-product-${gift.key}`} className="text-xs">
                          Linked product (optional)
                        </Label>
                        <Select
                          value={gift.product_id ?? "none"}
                          onValueChange={(value) => {
                            const nextId = value === "none" ? null : value;
                            const matched = products.find((p) => p.id === nextId);
                            updateGiftRow(gift.key, {
                              product_id: nextId,
                              ...(matched && !gift.gift_name.trim()
                                ? { gift_name: `Tặng ${matched.name}` }
                                : {}),
                            });
                          }}
                        >
                          <SelectTrigger id={`gift-product-${gift.key}`} className="h-10">
                            <SelectValue placeholder="No linked product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No linked product</SelectItem>
                            {products.map((prod) => (
                              <SelectItem key={prod.id} value={prod.id}>
                                {prod.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`gift-desc-${gift.key}`} className="text-xs">
                          Note / description
                        </Label>
                        <Input
                          id={`gift-desc-${gift.key}`}
                          maxLength={1000}
                          value={gift.description ?? ""}
                          placeholder="Optional gift note"
                          onChange={(e) =>
                            updateGiftRow(gift.key, { description: e.target.value || null })
                          }
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AvailableField available={plan ? plan.is_active : true} />
        </>
      )}
    </CatalogForm>
  );
}

function SubscriptionPlansCatalog() {
  const [editor, setEditor] = useState<{ plan?: AdminSubscriptionPlan } | null>(null);
  const [action, setAction] = useState<CatalogAction | null>(null);

  const plansQuery = useQuery({
    queryKey: [...adminSubscriptionsKey, "plans"],
    queryFn: ({ signal }) => subscriptionApi.listAdminPlans(signal),
    retry: false,
  });

  return (
    <section
      aria-labelledby="admin-subscription-plans-title"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-5">
        <div>
          <h2 id="admin-subscription-plans-title" className="text-base font-semibold">
            Subscription plans & gifts
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create and configure 7-day, 30-day, or custom meal packages and bundled gifts.
          </p>
        </div>
        <Button data-catalog-add className="min-h-11" onClick={() => setEditor({})}>
          Create plan
        </Button>
      </div>

      {plansQuery.isPending ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">
          Loading subscription plans…
        </p>
      ) : plansQuery.isError ? (
        <div className="p-4 sm:px-5">
          <SectionError
            message={plansQuery.error?.message ?? "Could not load subscription plans."}
            retry={() => void plansQuery.refetch()}
          />
        </div>
      ) : plansQuery.data.data.length === 0 ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">
          No subscription plans configured yet. Create your first plan to open customer
          registrations.
        </p>
      ) : (
        <CatalogTable
          name="Subscription plans"
          columns={[
            "Plan",
            "Duration & meals",
            "Price",
            "Bundled gifts",
            "Subscribers",
            "Status",
            "Actions",
          ]}
        >
          {plansQuery.data.data.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="min-w-44 max-w-64 [overflow-wrap:anywhere]">
                <p className="font-medium">{plan.name}</p>
                {plan.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {plan.duration_days} days · {plan.meals_per_day}/day (
                {plan.duration_days * plan.meals_per_day} meals)
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium tabular-nums">
                {vnd.format(plan.price)}
              </TableCell>
              <TableCell className="min-w-48 max-w-64">
                {plan.gifts.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {plan.gifts.map((gift) => (
                      <li key={gift.id} className="[overflow-wrap:anywhere]">
                        {gift.gift_name} <span className="font-semibold">×{gift.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm tabular-nums">
                <span>{plan.in_progress_count} active</span>
                {plan.pending_count > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({plan.pending_count} pending)
                  </span>
                )}
              </TableCell>
              <TableCell>
                <AvailabilityBadge available={plan.is_active} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1 whitespace-nowrap">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Edit ${plan.name}`}
                    onClick={() => setEditor({ plan })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`${plan.is_active ? "Pause" : "Resume"} ${plan.name}`}
                    onClick={() =>
                      setAction(
                        salesAction(plan.name, plan.is_active === true, () =>
                          subscriptionApi.updateAdminPlan(plan.id, {
                            is_active: plan.is_active !== true,
                          }),
                        ),
                      )
                    }
                  >
                    {plan.is_active ? "Pause" : "Resume"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </CatalogTable>
      )}

      {editor && <PlanEditor plan={editor.plan} onClose={() => setEditor(null)} />}
      {action && (
        <CatalogConfirm
          action={action}
          queryKey={adminSubscriptionsKey}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}

function CustomerSubscriptionsDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<AdminSubscriptionView>("in_progress");
  const [planId, setPlanId] = useState("all");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<CatalogAction | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const plansQuery = useQuery({
    queryKey: [...adminSubscriptionsKey, "plans"],
    queryFn: ({ signal }) => subscriptionApi.listAdminPlans(signal),
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: [...adminSubscriptionsKey, "customers", { search, view, planId, page }],
    queryFn: ({ signal }) =>
      subscriptionApi.listAdminSubscriptions({ search, view, plan_id: planId, page }, signal),
    retry: false,
  });

  const planChoices = [
    { value: "all", label: "All plans" },
    ...(plansQuery.data?.data.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.duration_days}d)`,
    })) ?? []),
  ];

  function renderActions(sub: AdminSubscription) {
    const buttons = [];
    if (sub.status === "PENDING") {
      buttons.push(
        <Button
          key="activate"
          variant="outline"
          className="min-h-11"
          aria-label={`Activate subscription for ${sub.customer_name}`}
          onClick={() =>
            setConfirmAction({
              title: "Confirm subscription",
              description: `Activate “${sub.plan_name}” for ${sub.customer_name} (${formatCalendarDate(sub.start_date)}–${formatCalendarDate(sub.end_date)})?`,
              success: "Subscription activated.",
              run: () => subscriptionApi.updateAdminSubscription(sub.id, { status: "ACTIVE" }),
            })
          }
        >
          Confirm
        </Button>,
      );
    }
    if (sub.status !== "CANCELLED" && sub.payment_status === "PENDING") {
      buttons.push(
        <Button
          key="paid"
          variant="ghost"
          className="min-h-11"
          aria-label={`Mark payment received for ${sub.customer_name}`}
          onClick={() =>
            setConfirmAction({
              title: "Record payment",
              description: `Mark ${vnd.format(sub.total_amount)} (${sub.payment_method}) as PAID for ${sub.customer_name}?`,
              success: "Payment recorded.",
              run: () =>
                subscriptionApi.updateAdminSubscription(sub.id, { payment_status: "PAID" }),
            })
          }
        >
          Mark paid
        </Button>,
      );
    }
    if (sub.status === "PENDING" || (sub.status === "ACTIVE" && sub.phase !== "ENDED")) {
      buttons.push(
        <Button
          key="cancel"
          variant="ghost"
          className="min-h-11 text-destructive hover:text-destructive"
          aria-label={`Cancel subscription for ${sub.customer_name}`}
          onClick={() =>
            setConfirmAction({
              title: "Cancel subscription",
              description: `Cancel “${sub.plan_name}” for ${sub.customer_name}? Any pending plan gifts will also be cancelled.`,
              destructive: true,
              success: "Subscription cancelled.",
              run: () => subscriptionApi.updateAdminSubscription(sub.id, { status: "CANCELLED" }),
            })
          }
        >
          Cancel
        </Button>,
      );
    }
    return buttons.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">{buttons}</div>
    ) : (
      <span className="text-xs text-muted-foreground">No actions</span>
    );
  }

  return (
    <section
      aria-labelledby="admin-customer-subscriptions-title"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="space-y-4 border-b border-border p-4 sm:p-5">
        <div>
          <h2 id="admin-customer-subscriptions-title" className="text-base font-semibold">
            Customer subscriptions
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Monitor customers currently using meal plans, confirm new registrations, and manage
            payment status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <CatalogInput
            label="Search subscribers"
            type="search"
            value={query}
            maxLength={200}
            placeholder="Customer name, email or phone"
            onChange={(event) => setQuery(event.target.value)}
          />
          <CatalogSelect
            label="Subscription phase"
            value={view}
            options={viewChoices}
            onValueChange={(value) => {
              setView(value as AdminSubscriptionView);
              setPage(1);
            }}
          />
          <CatalogSelect
            label="Plan"
            value={planId}
            options={planChoices}
            onValueChange={(value) => {
              setPlanId(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {listQuery.isPending ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">
          Loading customer subscriptions…
        </p>
      ) : listQuery.isError ? (
        <div className="p-4 sm:px-5">
          <SectionError
            message={listQuery.error?.message ?? "Could not load customer subscriptions."}
            retry={() => void listQuery.refetch()}
          />
        </div>
      ) : listQuery.data.data.length === 0 ? (
        <div className="space-y-2 p-8 text-center">
          <p>No matching customer subscriptions.</p>
          <p className="text-sm text-muted-foreground">
            Try switching the subscription phase filter to “All subscriptions” or clearing the
            search query.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableCaption className="sr-only">
                Customers subscribed to meal plans, schedule dates, gifts, and payment status
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  {["Customer", "Plan & gifts", "Schedule", "Payment", "Status", "Actions"].map(
                    (heading) => (
                      <TableHead key={heading} scope="col" className="px-4">
                        {heading}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.data.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="max-w-60 px-4 [overflow-wrap:anywhere]">
                      <p className="font-medium">{sub.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.customer_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.customer_phone || "No phone"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-64 px-4 [overflow-wrap:anywhere]">
                      <p className="font-medium">{sub.plan_name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {sub.duration_days} days · {sub.meals_per_day} meals/day
                      </p>
                      {sub.gifts.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Gifts:{" "}
                          {sub.gifts.map((g) => `${g.gift_name} (×${g.quantity})`).join(", ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 text-sm tabular-nums">
                      <p>
                        {formatCalendarDate(sub.start_date)} – {formatCalendarDate(sub.end_date)}
                      </p>
                      {sub.address_detail && (
                        <p className="mt-0.5 max-w-52 truncate text-xs text-muted-foreground">
                          {sub.address_detail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 text-sm tabular-nums">
                      <p className="font-medium">{vnd.format(sub.total_amount)}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{sub.payment_method}</span>
                        <span>·</span>
                        <Badge
                          variant={sub.payment_status === "PAID" ? "success" : "secondary"}
                          className="px-1.5 py-0 text-[11px]"
                        >
                          {sub.payment_status ?? "PENDING"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <SubscriptionPhaseBadge phase={sub.phase} />
                    </TableCell>
                    <TableCell className="px-4">{renderActions(sub)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul aria-label="Customer subscriptions" className="divide-y divide-border md:hidden">
            {listQuery.data.data.map((sub) => (
              <li key={sub.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold [overflow-wrap:anywhere]">
                      {sub.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {sub.customer_email} · {sub.customer_phone || "No phone"}
                    </p>
                  </div>
                  <SubscriptionPhaseBadge phase={sub.phase} />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium [overflow-wrap:anywhere]">
                      {sub.plan_name} ({sub.duration_days}d · {sub.meals_per_day}/day)
                    </dd>
                  </div>
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-muted-foreground">Dates</dt>
                    <dd className="tabular-nums">
                      {formatCalendarDate(sub.start_date)} – {formatCalendarDate(sub.end_date)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd className="tabular-nums">
                      {vnd.format(sub.total_amount)} · {sub.payment_method} (
                      {sub.payment_status ?? "PENDING"})
                    </dd>
                  </div>
                  {sub.gifts.length > 0 && (
                    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                      <dt className="text-muted-foreground">Gifts</dt>
                      <dd className="[overflow-wrap:anywhere]">
                        {sub.gifts.map((g) => `${g.gift_name} (×${g.quantity})`).join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
                {renderActions(sub)}
              </li>
            ))}
          </ul>
        </>
      )}

      {listQuery.data && !listQuery.isError && (
        <div className="border-t border-border px-4 sm:px-5">
          <PageControls
            page={page}
            total={listQuery.data.pagination.total}
            size={listQuery.data.pagination.page_size}
            onChange={setPage}
            pending={listQuery.isFetching}
          />
        </div>
      )}

      {confirmAction && (
        <CatalogConfirm
          action={confirmAction}
          queryKey={adminSubscriptionsKey}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </section>
  );
}

export function SubscriptionManager() {
  return (
    <Tabs defaultValue="subscribers" className="min-w-0">
      <TabsList
        aria-label="Subscription management sections"
        className="grid h-auto w-full grid-cols-2 sm:inline-grid sm:w-auto"
      >
        <TabsTrigger value="subscribers" className="min-h-11 px-4">
          Active subscribers
        </TabsTrigger>
        <TabsTrigger value="plans" className="min-h-11 px-4">
          Subscription plans
        </TabsTrigger>
      </TabsList>
      <TabsContent value="subscribers" className="mt-4">
        <CustomerSubscriptionsDirectory />
      </TabsContent>
      <TabsContent value="plans" className="mt-4">
        <SubscriptionPlansCatalog />
      </TabsContent>
      <Toaster position="bottom-center" visibleToasts={1} />
    </Tabs>
  );
}
