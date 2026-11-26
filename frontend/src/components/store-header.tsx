import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { logout } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const catalogLinks = [
  { to: "/menu", label: "Menu" },
  { to: "/plans", label: "Plans" },
  { to: "/nutrition", label: "Nutrition" },
] as const;

export function StoreHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY)));
    sync();
    window.addEventListener("fitkitchen:session-change", sync);
    window.addEventListener("fitkitchen:session-invalid", sync);
    return () => {
      window.removeEventListener("fitkitchen:session-change", sync);
      window.removeEventListener("fitkitchen:session-invalid", sync);
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 640px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  function signOut() {
    setMenuOpen(false);
    void logout();
    void navigate({ to: "/" });
  }

  const links = [
    ...catalogLinks,
    signedIn ? { to: "/account", label: "Account" } : { to: "/login", label: "Sign in" },
  ] as const;
  const navigation = links.map(({ to, label }) => {
    const current = pathname === to;
    const inSection =
      (to === "/menu" && pathname.startsWith("/meal/")) ||
      (to === "/account" && pathname.startsWith("/account/"));
    return (
      <Link
        key={to}
        to={to}
        activeOptions={{ exact: true, includeSearch: false, includeHash: false }}
        aria-current={current ? "page" : inSection ? "location" : undefined}
        onClick={() => setMenuOpen(false)}
        className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold transition-colors hover:text-coral ${current || inSection ? "text-foreground underline underline-offset-4" : "text-muted-foreground"}`}
      >
        {label}
      </Link>
    );
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-2.5" aria-label="FitFuel home">
          <span className="grid size-9 place-items-center rounded-sm bg-lime text-foreground">
            <Activity className="size-5" strokeWidth={2.6} />
          </span>
          <span className="font-display text-xl font-bold">
            fitfuel<span className="text-coral">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
          <nav className="hidden items-center gap-6 sm:flex lg:gap-9" aria-label="Main navigation">
            {navigation}
          </nav>
          <CartDrawer />
          {signedIn && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="hidden size-11 sm:inline-flex"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" aria-hidden />
            </Button>
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 sm:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent aria-describedby={undefined} className="overflow-y-auto">
              <SheetTitle>Navigation</SheetTitle>
              <nav className="mt-4 flex flex-col" aria-label="Main navigation">
                {navigation}
              </nav>
              {signedIn && (
                <Button variant="ghost" onClick={signOut} className="mt-3 min-h-11">
                  <LogOut className="size-4" aria-hidden /> Sign out
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
