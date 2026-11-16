import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, ArrowUpRight, ShieldCheck } from "lucide-react";
import { CartDrawer } from "@/components/cart-drawer";

export function StoreHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-2.5" aria-label="FitFuel home">
          <span className="grid size-9 place-items-center rounded-sm bg-lime text-foreground"><Activity className="size-5" strokeWidth={2.6} /></span>
          <span className="font-display text-xl font-bold">fitfuel<span className="text-coral">.</span></span>
        </Link>
        <nav className="flex items-center gap-5 sm:gap-9" aria-label="Main navigation">
          <Link to="/" className={`text-sm font-semibold transition-colors hover:text-coral ${pathname === "/" ? "text-foreground" : "text-muted-foreground"}`}>The menu</Link>
          <Link to="/dashboard" className={`flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-coral ${pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"}`}><span className="hidden sm:inline">Your fuel</span><span className="sm:hidden">Macros</span><ArrowUpRight className="hidden size-3.5 sm:block" /></Link>
          <Link to="/admin" aria-label="Open admin workspace" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"><ShieldCheck className="size-4" /></Link>
          <CartDrawer />
        </nav>
      </div>
    </header>
  );
}