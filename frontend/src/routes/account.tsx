import { skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity, CalendarDays, Package } from "lucide-react";
import { CustomerAccess } from "@/components/customer-access";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import type { Session } from "@/lib/admin-api";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Account | FitFuel Kitchen" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AccountPage,
});

const accountLinks = [
  { to: "/account/orders", label: "Orders", Icon: Package },
  { to: "/account/plans", label: "My plans", Icon: CalendarDays },
  { to: "/account/tracker", label: "Fuel tracker", Icon: Activity },
] as const;

function AccountPage() {
  return (
    <CustomerAccess>
      <AccountContent />
    </CustomerAccess>
  );
}

function AccountContent() {
  // Read the session already fetched by CustomerAccess.
  const { data: session } = useQuery<{ data: Session }>({
    queryKey: ["session", "customer"],
    queryFn: skipToken,
  });

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12">
        <h1 className="font-display text-3xl font-bold">Your account</h1>
        {session && (
          <p className="mt-2 wrap-anywhere text-muted-foreground">Hi, {session.data.full_name}</p>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <nav
            aria-label="Account"
            className="flex min-w-0 justify-between gap-0.5 overflow-x-auto sm:justify-start sm:gap-1 lg:flex-col"
          >
            {accountLinks.map(({ to, label, Icon }) => (
              <Button
                key={to}
                asChild
                variant="ghost"
                className="min-h-11 shrink-0 justify-start gap-1 px-1.5 text-muted-foreground focus-visible:ring-inset focus-visible:ring-offset-0 data-[status=active]:bg-secondary data-[status=active]:font-semibold data-[status=active]:text-secondary-foreground sm:gap-2 sm:px-3"
              >
                <Link to={to} activeOptions={{ exact: true, includeSearch: false }}>
                  <Icon aria-hidden /> {label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="min-w-0 [&>section]:mt-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
