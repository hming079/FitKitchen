import { useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, cartId, checkoutUrl, isLoading, isSyncing, error, syncCart, updateQuantity, removeItem } = useCartStore();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price.amount) * item.quantity, 0);
  const currency = items[0]?.price.currencyCode ?? "VND";
  const subtotalLabel = new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(subtotal);

  useEffect(() => {
    if (open) void syncCart();
  }, [open, syncCart]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-11 rounded-sm border-foreground/15 bg-background" aria-label={`Open cart, ${itemCount} items`}>
          <ShoppingBag className="size-[19px]" />
          <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-lime text-[11px] font-bold text-foreground">{itemCount}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 border-l border-border bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-6 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-coral">Your order</p>
          <SheetTitle className="font-display text-3xl">The fuel bag <span className="text-muted-foreground">({itemCount})</span></SheetTitle>
          <SheetDescription>Fresh fuel for wherever you’re headed.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-secondary text-foreground"><ShoppingBag className="size-7" /></div>
              <p className="font-display text-xl">Your bag is taking a rest.</p>
              <Button variant="outline" onClick={() => setOpen(false)}>Explore the menu</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const image = item.product.images.edges[0]?.node;
                return (
                  <article key={item.variantId} className="flex gap-4 py-5">
                    <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-secondary">
                      {image && <img src={image.url} alt={image.altText ?? item.product.title} className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{item.product.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.variantTitle}</p>
                      <p className="mt-2 text-sm font-bold">{formatPrice(item.price)}</p>
                      <div className="mt-3 flex items-center gap-1">
                        <Button variant="outline" size="icon" className="size-8 rounded-sm" aria-label={`Decrease ${item.product.title} quantity`} disabled={isLoading} onClick={() => void updateQuantity(item.variantId, item.quantity - 1)}><Minus className="size-3.5" /></Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="size-8 rounded-sm" aria-label={`Increase ${item.product.title} quantity`} disabled={isLoading} onClick={() => void updateQuantity(item.variantId, item.quantity + 1)}><Plus className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="ml-2 size-8 rounded-sm text-muted-foreground" aria-label={`Remove ${item.product.title}`} disabled={isLoading} onClick={() => void removeItem(item.variantId)}><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="space-y-3 border-t border-border bg-background px-6 py-5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{subtotalLabel}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span className="text-muted-foreground">Calculated at checkout</span></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="h-12 w-full rounded-sm bg-primary text-primary-foreground" disabled={!cartId || !checkoutUrl || isLoading || isSyncing} onClick={() => {
              if (checkoutUrl) window.open(checkoutUrl, "_blank", "noopener,noreferrer");
            }}>
              {isLoading || isSyncing ? <LoaderCircle className="size-4 animate-spin" /> : <>Checkout <ArrowUpRight className="size-4" /></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Total {subtotalLabel} before shipping and applicable taxes</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}