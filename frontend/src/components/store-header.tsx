import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, ArrowUpRight, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { logout } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";

export function StoreHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
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

  function signOut() {
    void logout();
    void navigate({ to: "/" });
  }
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
        <nav className="flex items-center gap-3 sm:gap-9" aria-label="Main navigation">
          <Link
            to="/"
            className={`text-sm font-semibold transition-colors hover:text-coral ${pathname === "/" ? "text-foreground" : "text-muted-foreground"}`}
          >
            The menu
          </Link>
          <Link
            to="/dashboard"
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-coral ${pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"}`}
          >
            <span className="hidden sm:inline">Your fuel</span>
            <span className="sm:hidden">Macros</span>
            <ArrowUpRight className="hidden size-3.5 sm:block" />
          </Link>
          {signedIn ? (
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 sm:px-3">
              <LogOut className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link to="/login">
                <LogIn className="size-4 sm:hidden" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            </Button>
          )}
          <CartDrawer />
        </nav>
      </div>
    </header>
  );
}
