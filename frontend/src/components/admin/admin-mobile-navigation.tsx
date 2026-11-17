import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AdminMobileNavigation({
  children,
}: {
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Match the shell's lg breakpoint; do not leave an invisible modal trapping
    // focus or blocking the desktop sidebar after a viewport resize.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const changed = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", changed);
    return () => desktop.removeEventListener("change", changed);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[min(18rem,100%)] flex-col gap-0 overflow-y-auto bg-card p-0 text-card-foreground sm:max-w-none"
      >
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Choose a kitchen operations section.
        </SheetDescription>
        {children(() => setOpen(false))}
      </SheetContent>
    </Sheet>
  );
}
