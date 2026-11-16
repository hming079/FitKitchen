import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MealCustomizationDialog } from "@/components/meal-customization-dialog";
import { formatPrice, productGoal, productMacros, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

const macroDetails = [
  { key: "calories", label: "kcal", suffix: " kcal", accent: "text-coral" },
  { key: "protein", label: "protein", suffix: "g", accent: "text-fresh" },
  { key: "carbs", label: "carbs", suffix: "g", accent: "text-lime" },
  { key: "fat", label: "fat", suffix: "g", accent: "text-muted-foreground" },
];

export function MealCard({ product }: { product: ShopifyProduct }) {
  const variant = product.variants.edges.find(({ node }) => node.availableForSale)?.node;
  const image = product.images.edges[0]?.node;
  const macros = productMacros(product.tags);
  const goal = productGoal(product.tags);
  const addItem = useCartStore((state) => state.addItem);
  const loading = useCartStore((state) => state.isLoading);
  const cartError = useCartStore((state) => state.error);
  const [added, setAdded] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const handleAdd = async () => {
    if (!variant) return false;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions,
    });
    if (!useCartStore.getState().error) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
      return true;
    }
    return false;
  };

  return (
    <article className="group overflow-hidden rounded-sm border border-border bg-card">
      <Link to="/product/$handle" params={{ handle: product.handle }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {image ? (
            <img src={image.url} alt={image.altText ?? product.title} loading="lazy" width={800} height={600} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted-foreground">Meal photo coming soon</div>
          )}
          {goal && <span className="absolute left-3 top-3 bg-lime px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground">{goal}</span>}
          <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-background text-foreground opacity-0 transition-opacity group-hover:opacity-100"><ArrowUpRight className="size-4" /></span>
        </div>
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-semibold leading-tight">{product.title}</h3>
            <p className="shrink-0 pt-0.5 text-sm font-bold">{formatPrice(product.priceRange.minVariantPrice)}</p>
          </div>
          {product.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>}
        </div>
      </Link>
      <div className="grid grid-cols-4 divide-x divide-border border-t border-border px-2 py-3">
        {macroDetails.map((macro) => (
          <div key={macro.key} className="px-2 text-center">
            <p className={`text-sm font-bold tabular-nums ${macro.accent}`}>{macros[macro.key] ? `${macros[macro.key]}${macro.suffix}` : "—"}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{macro.label}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <Button onClick={() => setCustomizeOpen(true)} disabled={!variant || loading} className="h-10 w-full rounded-sm text-xs font-bold uppercase tracking-[0.09em]">
          {added ? <><Check className="size-4" /> Added</> : <><Plus className="size-4" /> Add to cart</>}
        </Button>
        {cartError && !added && <p role="alert" className="mt-2 text-xs text-destructive">{cartError}</p>}
      </div>
      {variant && <MealCustomizationDialog open={customizeOpen} onOpenChange={setCustomizeOpen} product={product} variant={variant} adding={loading} error={cartError} onAdd={handleAdd} />}
    </article>
  );
}