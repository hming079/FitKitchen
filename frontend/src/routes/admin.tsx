import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CatalogManager } from "@/components/admin/catalog/catalog-manager";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminOrders } from "@/components/admin/admin-orders";
import { CustomerDirectory } from "@/components/admin/customer-directory";
import { SubscriptionManager } from "@/components/admin/subscription-manager";
import { AdminAccess } from "@/components/admin/admin-access";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";
import { type Session } from "@/lib/admin-api";
import { logout } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import {
  BadgePercent,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  Settings2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operations | FitFuel Kitchen" },
      { name: "description", content: "FitFuel Kitchen operations dashboard." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AdminRoute,
});

type View = "Overview" | "Orders" | "Meals" | "Promotions" | "Customers" | "Subscriptions";
const nav: { name: View; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Orders", icon: ClipboardList },
  { name: "Meals", icon: UtensilsCrossed },
  { name: "Promotions", icon: BadgePercent },
  { name: "Customers", icon: Users },
  { name: "Subscriptions", icon: Boxes },
];

function AdminRoute() {
  return <AdminAccess>{(user) => <AdminPage key={user.id} user={user} />}</AdminAccess>;
}

function AdminPage({ user }: { user: Session }) {
  const navigate = useNavigate();
  const signOut = () => {
    void logout();
    void navigate({ to: "/login" });
  };
  const [view, setView] = useState<View>("Customers");
  const [notice, setNotice] = useState("");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
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
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => {
                onNavigate(name);
              }}
              className={`group flex h-10 w-full items-center gap-3 rounded-sm px-3 text-left text-[13px] font-medium transition-colors ${view === name ? "bg-brand-highlight text-brand-highlight-foreground" : "text-muted-foreground hover:bg-secondary hover:text-muted-foreground"}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{name}</span>
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
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{user.full_name}</div>
            <div className="text-[14px] text-muted-foreground">Kitchen admin</div>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
            className="rounded-sm p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-shell min-h-screen bg-background text-foreground">
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-border bg-card lg:flex">
        {sidebar(setView)}
      </aside>
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <AdminMobileNavigation>
              {(close) =>
                sidebar((nextView) => {
                  setView(nextView);
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
            <div className="grid size-8 place-items-center rounded-full bg-secondary text-[14px] font-bold text-muted-foreground">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[26px] font-semibold tracking-[-.045em] sm:text-[30px]">
                {view}
              </h1>
              <p className="mt-1 text-[14px] text-muted-foreground">{descriptions[view]}</p>
            </div>
          </div>
          {view === "Overview" && <AdminOverview onOrders={() => setView("Orders")} />}
          {view === "Orders" && <AdminOrders />}
          {view === "Meals" && <CatalogManager />}
          {view === "Promotions" && (
            <Panel title="Discount codes" sub="Demo discount codes.">
              <Promotions />
            </Panel>
          )}
          {view === "Customers" && <CustomerDirectory />}
          {view === "Subscriptions" && <SubscriptionManager />}
          <div className="mt-6 flex items-center justify-between text-[14px] text-muted-foreground">
            <span>© 2026 FitKitchen</span>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </main>
      </div>
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
  Overview: "Track sales and daily kitchen operations.",
  Orders: "Review deliveries and update fulfillment status.",
  Meals: "Manage meals, categories and product inventory.",
  Promotions: "Manage discounts and seasonal offers.",
  Customers: "Find customers, review their history and manage account access.",
  Subscriptions: "Configure subscription plans and gifts, and manage active subscribers.",
};

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
