import { createFileRoute } from "@tanstack/react-router";
import { CatalogManager } from "@/components/admin/catalog/catalog-manager";
import { CustomerDirectory } from "@/components/admin/customer-directory";
import { AdminAccess } from "@/components/admin/admin-access";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";
import { setAccessToken, type Session } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Command,
  Download,
  Ellipsis,
  Eye,
  Flame,
  LayoutDashboard,
  Leaf,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { demoOrders, formatUsd, type DemoOrder } from "@/lib/demo-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operations | FitFuel Kitchen" },
      { name: "description", content: "FitFuel Kitchen operations dashboard demo." },
    ],
  }),
  component: AdminRoute,
});

type View = "Overview" | "Orders" | "Meals" | "Promotions" | "Customers" | "Subscriptions";
type Status = "Pending" | "Preparing" | "Delivering" | "Completed" | "Cancelled";
const statuses: Status[] = ["Pending", "Preparing", "Delivering", "Completed", "Cancelled"];
const nav: { name: View; icon: typeof LayoutDashboard; count?: string }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Orders", icon: ClipboardList, count: "08" },
  { name: "Meals", icon: UtensilsCrossed },
  { name: "Promotions", icon: BadgePercent },
  { name: "Customers", icon: Users },
  { name: "Subscriptions", icon: Boxes },
];
// Fixtures for the pre-existing delivery preview only. Customers uses the backend.
const demoCustomers = [
  {
    name: "Linh Nguyen",
    email: "linh.nguyen@email.com",
    phone: "+84 912 345 678",
    goal: "Cut",
    initials: "LN",
    color: "peach",
  },
  {
    name: "Marcus Tran",
    email: "marcus.tran@email.com",
    phone: "+84 903 782 111",
    goal: "Bulk",
    initials: "MT",
    color: "lavender",
  },
  {
    name: "An Pham",
    email: "an.pham@email.com",
    phone: "+84 987 654 321",
    goal: "Maintain",
    initials: "AP",
    color: "mint",
  },
  {
    name: "Jade Le",
    email: "jade.le@email.com",
    phone: "+84 908 234 567",
    goal: "Cut",
    initials: "JL",
    color: "blue",
  },
  {
    name: "Minh Vo",
    email: "minh.vo@email.com",
    phone: "+84 916 222 354",
    goal: "Bulk",
    initials: "MV",
    color: "yellow",
  },
  {
    name: "Sarah Do",
    email: "sarah.do@email.com",
    phone: "+84 934 321 899",
    goal: "Maintain",
    initials: "SD",
    color: "pink",
  },
];
const weekly = [
  { day: "Mon", amount: 640 },
  { day: "Tue", amount: 820 },
  { day: "Wed", amount: 700 },
  { day: "Thu", amount: 1050 },
  { day: "Fri", amount: 900 },
  { day: "Sat", amount: 1230 },
  { day: "Sun", amount: 980 },
];

function AdminRoute() {
  return <AdminAccess>{(user) => <AdminPage key={user.id} user={user} />}</AdminAccess>;
}

function AdminPage({ user }: { user: Session }) {
  const [view, setView] = useState<View>("Customers");
  const showDemoControls = view !== "Customers" && view !== "Meals";
  const [orders, setOrders] = useState<(Omit<DemoOrder, "status"> & { status: Status })[]>(
    demoOrders.map((o) => ({ ...o, status: o.status as Status })),
  );
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState("This week");
  const filteredOrders = orders.filter((o) =>
    `${o.id} ${o.customer}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = orders.find((order) => order.id === selectedOrder);
  const setStatus = (id: string, status: Status) =>
    setOrders((list) => list.map((order) => (order.id === id ? { ...order, status } : order)));
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const selectView = (nextView: View) => {
    setView(nextView);
    setQuery("");
  };
  const sidebar = (onNavigate: (nextView: View) => void) => (
    <>
      <div className="flex h-[76px] shrink-0 items-center gap-3 pl-6 pr-16 lg:pr-6">
        <div className="grid size-9 place-items-center rounded-sm bg-secondary text-muted-foreground">
          <Leaf size={19} />
        </div>
        <div>
          <div className="font-display text-[17px] font-bold tracking-[-.04em]">
            bepfit<span className="text-muted-foreground">.</span>
          </div>
          <div className="text-[14px] font-semibold uppercase tracking-[.17em] text-muted-foreground">
            Kitchen operations
          </div>
        </div>
      </div>
      <div className="px-4 pt-6">
        <div className="mb-2 px-3 text-[14px] font-bold uppercase tracking-[.16em] text-muted-foreground">
          Workspace
        </div>
        <nav className="space-y-1" aria-label="Admin navigation">
          {nav.map(({ name, icon: Icon, count }) => (
            <button
              key={name}
              onClick={() => {
                onNavigate(name);
              }}
              className={`group flex h-10 w-full items-center gap-3 rounded-sm px-3 text-left text-[13px] font-medium transition-colors ${view === name ? "bg-brand-highlight text-brand-highlight-foreground" : "text-muted-foreground hover:bg-secondary hover:text-muted-foreground"}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{name}</span>
              {count && showDemoControls && (
                <span className="ml-auto rounded-md bg-card px-1.5 py-0.5 text-[14px] text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-8 px-4">
        <div className="mb-2 px-3 text-[14px] font-bold uppercase tracking-[.16em] text-muted-foreground">
          Workspace
        </div>
        <button
          onClick={() => toast("Settings are part of the connected admin rollout")}
          className="flex h-10 w-full items-center gap-3 rounded-sm px-3 text-[13px] font-medium text-muted-foreground hover:bg-secondary"
        >
          <Settings2 size={17} strokeWidth={1.8} /> Settings
        </button>
      </div>
      <div className="mt-auto px-4 pb-4">
        {showDemoControls && (
          <div className="mb-4 rounded-sm border border-border bg-secondary p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-sm bg-secondary text-muted-foreground">
                <Sparkles size={14} />
              </span>
              <span className="text-[13px] font-semibold">Kitchen tip</span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Saturday orders are up 18%. Prep extra protein bowls.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{user.full_name}</div>
            <div className="text-[14px] text-muted-foreground">Kitchen admin</div>
          </div>
          <Ellipsis size={17} className="text-muted-foreground" />
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-shell min-h-screen bg-background text-foreground">
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-border bg-card lg:flex">
        {sidebar(selectView)}
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <AdminMobileNavigation>
              {(close) =>
                sidebar((nextView) => {
                  selectView(nextView);
                  close();
                })
              }
            </AdminMobileNavigation>
            <div className="hidden items-center gap-2 text-[13px] text-muted-foreground sm:flex">
              <span>Kitchen</span>
              <ChevronRight size={13} />
              <span className="font-medium text-muted-foreground">{view}</span>
            </div>
            <div className="sm:hidden text-sm font-semibold">{view}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {showDemoControls && (
              <>
                <div className="hidden items-center gap-2 rounded-sm border border-border bg-secondary px-3 py-2 text-[13px] text-muted-foreground md:flex">
                  <Command size={13} />
                  <span>⌘ K</span>
                  <span className="text-muted-foreground">Quick search</span>
                </div>
                <button
                  className="relative rounded-sm p-2 text-muted-foreground hover:bg-secondary"
                  aria-label="Notifications"
                  onClick={() => toast("You’re all caught up")}
                >
                  <Bell size={18} />
                  <i className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-secondary" />
                </button>
                <div className="hidden h-7 border-l border-border sm:block" />
                <span className="hidden text-[13px] text-muted-foreground sm:inline">
                  Mon, 16 Nov
                </span>
              </>
            )}
            <div className="grid size-8 place-items-center rounded-full bg-secondary text-[14px] font-bold text-muted-foreground">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              {showDemoControls && (
                <div className="mb-1.5 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.15em] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-secondary" /> Monday, November 16, 2026
                </div>
              )}
              <h1 className="font-display text-[26px] font-semibold tracking-[-.045em] sm:text-[30px]">
                {view === "Overview" ? "Operations preview" : view}
              </h1>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {view === "Overview"
                  ? "Here’s what’s happening in your kitchen today."
                  : descriptions[view]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {showDemoControls && (
                <button
                  onClick={() => toast("Report exported from demo data")}
                  className="flex h-9 items-center gap-2 rounded-sm border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground shadow-sm hover:bg-secondary"
                >
                  <Download size={14} /> <span className="hidden sm:inline">Export report</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
          </div>
          {view === "Overview" && (
            <Overview
              orders={orders}
              onOrders={() => setView("Orders")}
              range={range}
              onRange={setRange}
            />
          )}
          {view === "Orders" && (
            <Panel
              title="All orders"
              sub="Manage incoming orders and fulfillment status."
              right={<SearchBox value={query} onChange={setQuery} placeholder="Search orders..." />}
            >
              <OrdersTable orders={filteredOrders} onStatus={setStatus} onView={setSelectedOrder} />
            </Panel>
          )}
          {view === "Meals" && <CatalogManager />}
          {view === "Promotions" && (
            <Panel title="Discount codes" sub="Create and manage customer offers.">
              <Promotions />
            </Panel>
          )}
          {view === "Customers" && <CustomerDirectory />}
          {view === "Subscriptions" && <Subscriptions />}
          <div className="mt-6 flex items-center justify-between text-[14px] text-muted-foreground">
            <span>© 2026 FitKitchen{view !== "Meals" && " · Other tabs use demo data"}</span>
            <Button variant="ghost" onClick={() => setAccessToken(null)}>
              Sign out
            </Button>
          </div>
        </main>
      </div>
      {selected && (
        <Modal
          title={`Order ${selected.id}`}
          description="Order details and kitchen customization."
          onClose={() => setSelectedOrder(null)}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-sm bg-secondary p-3">
              <div>
                <div className="text-xs font-semibold">{selected.customer}</div>
                <div className="mt-1 text-[14px] text-muted-foreground">
                  Ordered Nov 16 · {selected.slot}
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span>
                  Teriyaki chicken & brown rice <span className="text-[#a3aca4">× 2</span>
                </span>
                <b>{formatUsd(12)}</b>
              </div>
              <div className="ml-2 border-l-2 border-border pl-3 text-[14px] leading-5 text-muted-foreground">
                Upsize: Large portion (+$2)
                <br />
                Toppings: Avocado, extra broccoli
              </div>
              <div className="flex justify-between text-xs">
                <span>
                  Grilled beef striploin <span className="text-[#a3aca4">× 1</span>
                </span>
                <b>{formatUsd(8.5)}</b>
              </div>
              <div className="ml-2 border-l-2 border-border pl-3 text-[14px] leading-5 text-muted-foreground">
                Upsize: Regular
                <br />
                Toppings: Sesame crunch, chili oil
              </div>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-sm font-bold">
              <span>Total</span>
              <span>{formatUsd(selected.total)}</span>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full rounded-sm bg-secondary py-2.5 text-xs font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        </Modal>
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-sm bg-primary px-4 py-3 text-xs font-medium text-primary-foreground shadow-xl"
        >
          <Check size={15} className="text-muted-foreground" />
          {notice}
        </div>
      )}
    </div>
  );
}

const descriptions: Record<View, string> = {
  Overview: "",
  Orders: "Review orders, delivery windows and fulfillment progress.",
  Meals: "Manage meals, categories and product inventory.",
  Promotions: "Manage discounts and seasonal offers.",
  Customers: "Find customers, review their history and manage account access.",
  Subscriptions: "Plan upcoming deliveries for your meal subscribers.",
};

function Overview({
  orders,
  onOrders,
  range,
  onRange,
}: {
  orders: (Omit<DemoOrder, "status"> & { status: Status })[];
  onOrders: () => void;
  range: string;
  onRange: (v: string) => void;
}) {
  const pending = orders.filter((o) => o.status === "Pending").length;
  const stats = [
    {
      title: "Daily revenue",
      value: "$2,845.00",
      change: "+12.8%",
      caption: "vs. previous day",
      icon: CircleDollarSign,
      accent: "green",
      data: "$2.8k",
    },
    {
      title: "Pending orders",
      value: String(pending + 7).padStart(2, "0"),
      change: "+3",
      caption: "need your attention",
      icon: ShoppingBag,
      accent: "peach",
      data: "4 urgent",
    },
    {
      title: "Active subscriptions",
      value: "248",
      change: "+8.2%",
      caption: "vs. last month",
      icon: Boxes,
      accent: "blue",
      data: "18 new",
    },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ title, value, change, caption, icon: Icon, accent, data }) => (
          <article
            key={title}
            className="rounded-sm border border-[#e9ede7] bg-white p-5 shadow-[0_2px_9px_rgba(35,52,37,.025)]"
          >
            <div className="flex items-start justify-between">
              <div className="text-[13px] font-medium text-[#849086]">{title}</div>
              <span
                className={`grid size-9 place-items-center rounded-sm ${accent === "green" ? "bg-[#edf5e3] text-[#5d8543]" : accent === "peach" ? "bg-[#fff0e9] text-[#d88668]" : "bg-[#eef2fb] text-[#788ec1]"}`}
              >
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="font-display text-[27px] font-semibold tracking-[-.045em]">
                  {value}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[14px]">
                  <span className="flex items-center gap-0.5 font-semibold text-[#61934b]">
                    <ArrowUpRight size={12} />
                    {change}
                  </span>
                  <span className="text-[#9aa39a]">{caption}</span>
                </div>
              </div>
              <div className="rounded-md bg-[#f7f9f5] px-2 py-1 text-[13px] font-medium text-[#768274]">
                {data}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.9fr)]">
        <section className="rounded-sm border border-[#e9ede7] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Sales overview</h2>
              <p className="mt-1 text-[14px] text-[#97a097]">Revenue performance across the week</p>
            </div>
            <select
              value={range}
              onChange={(e) => onRange(e.target.value)}
              className="rounded-sm border border-[#e9ede7] bg-white px-2.5 py-2 text-[14px] text-[#677369]"
            >
              <option>This week</option>
              <option>Last week</option>
              <option>This month</option>
            </select>
          </div>
          <div className="mt-5 grid grid-cols-[34px_1fr] gap-2">
            <div className="flex h-[188px] flex-col justify-between pb-6 text-right text-[13px] text-[#a1aaa1]">
              <span>$1.5k</span>
              <span>$1.0k</span>
              <span>$500</span>
              <span>$0</span>
            </div>
            <div className="relative">
              <div className="absolute inset-x-0 top-[8px] flex h-[146px] flex-col justify-between">
                <i className="border-t border-dashed border-[#edf0eb]" />
                <i className="border-t border-dashed border-[#edf0eb]" />
                <i className="border-t border-dashed border-[#edf0eb]" />
                <i className="border-t border-[#e9ede7]" />
              </div>
              <div className="relative grid h-[188px] grid-cols-7 items-end gap-2 px-1 sm:gap-5">
                {weekly.map(({ day, amount }, i) => (
                  <div key={day} className="flex h-full flex-col items-center justify-end gap-2">
                    <div
                      className="group relative flex w-full items-end justify-center"
                      style={{ height: 150 }}
                    >
                      <div
                        title={`${day}: $${amount}`}
                        className={`w-full max-w-[39px] rounded-t-md transition-all ${i === 5 ? "bg-lime" : "bg-[#e3efbd] hover:bg-[#d2e79b]"}`}
                        style={{ height: `${amount / 15}%` }}
                      />
                      <span className="pointer-events-none absolute -top-7 rounded-md bg-[#263b2b] px-2 py-1 text-[13px] text-white opacity-0 group-hover:opacity-100">
                        ${amount}
                      </span>
                    </div>
                    <span
                      className={`text-[13px] ${i === 5 ? "font-semibold text-[#476940]" : "text-[#96a097]"}`}
                    >
                      {day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-[#939e94]">
            <span className="size-2 rounded-sm bg-lime" />
            Daily revenue
            <span className="ml-auto font-medium text-[#717e71]">
              Total <b className="ml-1 text-[#344338]">$6,320</b>
            </span>
          </div>
        </section>
        <section className="rounded-sm border border-[#e9ede7] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4">
            <div>
              <h2 className="text-[13px] font-semibold">Recent orders</h2>
              <p className="mt-1 text-[14px] text-[#97a097]">Latest kitchen activity</p>
            </div>
            <button
              onClick={onOrders}
              className="flex items-center gap-1 text-[14px] font-semibold text-[#527749] hover:text-[#375a38]"
            >
              All orders <ArrowRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-[#f0f2ee]">
            {orders.slice(0, 4).map((o, i) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`grid size-8 place-items-center rounded-sm ${i % 2 ? "bg-[#f1f2fa] text-[#848bb5]" : "bg-[#f0f5e9] text-[#739354]"}`}
                >
                  <ShoppingBag size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{o.customer}</div>
                  <div className="mt-0.5 text-[13px] text-[#9ba49b]">
                    {o.id} · {o.date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold">{formatUsd(o.total)}</div>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onOrders}
            className="flex w-full items-center justify-center gap-2 border-t border-[#edf0eb] py-3 text-[14px] font-medium text-[#778379] hover:bg-[#fafbf9]"
          >
            View all orders <ArrowRight size={13} />
          </button>
        </section>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <MiniCard
          icon={Flame}
          title="Top meal this week"
          value="Teriyaki chicken bowl"
          note="142 orders · $852 revenue"
          color="orange"
        />
        <MiniCard
          icon={Truck}
          title="Deliveries today"
          value="32 scheduled"
          note="First window starts at 11:00 AM"
          color="blue"
        />
        <MiniCard
          icon={Wallet}
          title="Average order value"
          value="$28.45"
          note="Up 4.2% from last week"
          color="green"
        />
      </div>
    </>
  );
}
function MiniCard({
  icon: Icon,
  title,
  value,
  note,
  color,
}: {
  icon: typeof Flame;
  title: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-[#e9ede7] bg-white p-4">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-sm ${color === "orange" ? "bg-[#fff1e9] text-[#db9873]" : color === "blue" ? "bg-[#eef3fb] text-[#7b92bd]" : "bg-[#edf5e3] text-[#69894e]"}`}
      >
        <Icon size={15} />
      </span>
      <div>
        <div className="text-[14px] text-[#8d988e]">{title}</div>
        <div className="mt-1 text-[14px] font-semibold">{value}</div>
        <div className="mt-1 text-[13px] text-[#a0a9a0]">{note}</div>
      </div>
    </div>
  );
}
function Panel({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-sm border border-[#e9ede7] bg-white shadow-[0_2px_9px_rgba(35,52,37,.025)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <p className="mt-1 text-[14px] text-[#97a097]">{sub}</p>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-sm border border-[#e8ece6] bg-white px-3 text-[#89948a]">
      <Search size={14} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-36 bg-transparent text-[14px] text-[#445147] outline-none placeholder:text-[#a3aba3] sm:w-48"
      />
    </label>
  );
}
function DataTable({
  headers,
  children,
  min = "720px",
}: {
  headers: string[];
  children: ReactNode;
  min?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-[#edf0eb] bg-[#fafbf9]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[13px] font-semibold uppercase tracking-[.1em] text-[#9aa49b] sm:px-5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f2ee]">{children}</tbody>
      </table>
    </div>
  );
}
function OrdersTable({
  orders,
  onStatus,
  onView,
}: {
  orders: (Omit<DemoOrder, "status"> & { status: Status })[];
  onStatus: (id: string, status: Status) => void;
  onView: (id: string) => void;
}) {
  return (
    <DataTable
      headers={["Order ID", "Customer", "Total", "Delivery time slot", "Status", ""]}
      min="790px"
    >
      {orders.map((o) => (
        <tr key={o.id} className="hover:bg-[#fbfcfa]">
          <td className="px-4 py-3.5 text-[13px] font-semibold text-[#527749] sm:px-5">{o.id}</td>
          <td className="px-4 py-3.5">
            <div className="text-[13px] font-medium">{o.customer}</div>
            <div className="mt-0.5 text-[13px] text-[#a0a9a0]">{o.date}</div>
          </td>
          <td className="px-4 py-3.5 text-[13px] font-semibold">{formatUsd(o.total)}</td>
          <td className="px-4 py-3.5 text-[14px] text-[#778379]">{o.slot}</td>
          <td className="px-4 py-3.5">
            <StatusSelect status={o.status} onChange={(s) => onStatus(o.id, s)} />
          </td>
          <td className="px-4 py-3.5">
            <button
              aria-label={`View ${o.id} details`}
              onClick={() => onView(o.id)}
              className="rounded-md p-1.5 text-[#89948a] hover:bg-[#f0f4ed] hover:text-[#456b3d]"
            >
              <Eye size={15} />
            </button>
          </td>
        </tr>
      ))}
      {orders.length === 0 && <EmptyRow text="No matching orders." cols={6} />}
    </DataTable>
  );
}
function StatusSelect({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <select
        aria-label="Update order status"
        value={status}
        onChange={(e) => onChange(e.target.value as Status)}
        className="h-7 appearance-none rounded-full border-0 bg-[#f5f7f3] py-1 pl-2.5 pr-7 text-[13px] font-semibold text-[#657266] outline-none focus:ring-2 focus:ring-[#b7cf9e]"
      >
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 text-[#839083]" />
    </label>
  );
}
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: "bg-[#fff4e4] text-[#b87d32]",
    Preparing: "bg-[#edf2ff] text-[#657bb2]",
    Delivering: "bg-[#eff3fd] text-[#6e86bd]",
    Completed: "bg-[#edf5e7] text-[#648548]",
    Cancelled: "bg-[#fff0ed] text-[#c57564]",
  };
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? "bg-[#f2f3f1] text-[#788278]"}`}
    >
      {status}
    </span>
  );
}
function EmptyRow({ text, cols }: { text: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-12 text-center text-xs text-[#9aa49b]">
        {text}
      </td>
    </tr>
  );
}
function Promotions() {
  const [rows, setRows] = useState([
    { code: "WELCOME15", type: "Percentage", value: "15%", min: "$25.00", active: true, used: 128 },
    { code: "FUEL10", type: "Percentage", value: "10%", min: "$20.00", active: true, used: 84 },
    {
      code: "FITNESS5",
      type: "Fixed amount",
      value: "$5.00",
      min: "$35.00",
      active: false,
      used: 42,
    },
    { code: "COMBO20", type: "Percentage", value: "20%", min: "$60.00", active: true, used: 26 },
  ]);
  return (
    <DataTable
      headers={["Code", "Discount type", "Value", "Min. order amount", "Redemptions", "Active"]}
      min="760px"
    >
      {rows.map((r) => (
        <tr key={r.code} className="hover:bg-[#fbfcfa]">
          <td className="px-4 py-4 sm:px-5">
            <span className="rounded-md border border-dashed border-[#dce5d5] bg-[#f8faf6] px-2 py-1 font-mono text-[14px] font-bold tracking-wide text-[#547247]">
              {r.code}
            </span>
          </td>
          <td className="px-4 py-4 text-[14px] text-[#778379]">{r.type}</td>
          <td className="px-4 py-4 text-[13px] font-semibold">{r.value}</td>
          <td className="px-4 py-4 text-[14px] text-[#778379]">{r.min}</td>
          <td className="px-4 py-4 text-[14px] text-[#778379]">{r.used} uses</td>
          <td className="px-4 py-4">
            <button
              aria-label={`${r.active ? "Deactivate" : "Activate"} ${r.code}`}
              onClick={() =>
                setRows((all) =>
                  all.map((x) => (x.code === r.code ? { ...x, active: !x.active } : x)),
                )
              }
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${r.active ? "bg-[#648b4e]" : "bg-[#d7ddd5]"}`}
            >
              <span
                className={`size-4 rounded-full bg-white shadow-sm transition-transform ${r.active ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
function Subscriptions() {
  const subscriptions = [
    {
      customer: demoCustomers[0]!,
      package: "Lean & Green · 5 days",
      meals: ["Teriyaki chicken", "Salmon power bowl", "Turkey meatballs"],
      date: "Nov 17, 2026",
      time: "11:00 – 12:00",
      status: "Preparing",
    },
    {
      customer: demoCustomers[1]!,
      package: "Muscle Builder · 7 days",
      meals: ["Steak & sweet potato", "Chicken pesto pasta", "Beef bulgogi"],
      date: "Nov 17, 2026",
      time: "12:00 – 13:00",
      status: "Preparing",
    },
    {
      customer: demoCustomers[2]!,
      package: "Balanced Week · 5 days",
      meals: ["Miso salmon", "Citrus chicken bowl", "Tofu grain bowl"],
      date: "Nov 18, 2026",
      time: "11:00 – 12:00",
      status: "Scheduled",
    },
    {
      customer: demoCustomers[3]!,
      package: "Lean & Green · 3 days",
      meals: ["Lemon herb chicken", "Korean beef bowl", "Harvest tofu"],
      date: "Nov 18, 2026",
      time: "17:00 – 18:00",
      status: "Scheduled",
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniCard
          icon={Boxes}
          title="Active packages"
          value="248 subscribers"
          note="Across 4 meal plans"
          color="green"
        />
        <MiniCard
          icon={CalendarDays}
          title="Next delivery"
          value="Tomorrow · Nov 17"
          note="18 combo packages"
          color="blue"
        />
        <MiniCard
          icon={UtensilsCrossed}
          title="Meals to prepare"
          value="126 meal portions"
          note="Prep schedule is on track"
          color="orange"
        />
      </div>
      <Panel
        title="Upcoming combo deliveries"
        sub="Meal plans grouped by customer and expected delivery date."
        right={
          <button className="flex h-9 items-center gap-2 rounded-sm border border-[#e5eae3] px-3 text-[14px] font-medium text-[#647066]">
            <CalendarDays size={14} /> Delivery calendar
          </button>
        }
      >
        <DataTable
          headers={["Customer", "Package", "Included meals", "Expected delivery", "Status"]}
          min="880px"
        >
          {subscriptions.map((s) => (
            <tr key={s.customer.email} className="hover:bg-[#fbfcfa]">
              <td className="px-4 py-3.5 sm:px-5">
                <div className="text-[14px] font-semibold">{s.customer.name}</div>
                <div className="mt-0.5 text-[13px] text-[#9ba49b]">{s.customer.goal} plan</div>
              </td>
              <td className="px-4 py-3.5 text-[14px] font-medium">{s.package}</td>
              <td className="px-4 py-3.5">
                <div className="flex max-w-[280px] flex-wrap gap-1">
                  {s.meals.map((meal) => (
                    <span
                      key={meal}
                      className="rounded-md bg-[#f4f6f2] px-1.5 py-1 text-[13px] text-[#6f7b70]"
                    >
                      {meal}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5 text-[14px] font-medium">
                  <CalendarDays size={12} className="text-[#8ca37c]" />
                  {s.date}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#9ba49b]">
                  <Clock3 size={11} />
                  {s.time}
                </div>
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={s.status === "Scheduled" ? "Pending" : s.status} />
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#152219]/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-[440px] rounded-2xl border border-[#edf0eb] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="modal-title" className="font-display text-[18px] font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-[#929b93]">{description}</p>
          </div>
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="rounded-sm p-1.5 text-[#8d978e] hover:bg-[#f5f7f3]"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
