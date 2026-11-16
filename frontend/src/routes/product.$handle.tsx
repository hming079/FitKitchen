import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Check, Leaf, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { MealCustomizationDialog } from "@/components/meal-customization-dialog";
import { formatPrice, getShopifyProduct, productGoal, productMacros, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.handle.replaceAll("-", " ")} | FitFuel Kitchen` },
      { name: "description", content: "Get the details on this chef-made FitFuel meal, including its price and nutrition information." },
      { property: "og:title", content: `${params.handle.replaceAll("-", " ")} | FitFuel Kitchen` },
      { property: "og:description", content: "A FitFuel chef-made meal, with clear nutrition and pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

const macroInfo = [
  { key: "calories", label: "Calories", unit: "kcal", color: "text-coral" },
  { key: "protein", label: "Protein", unit: "g", color: "text-fresh" },
  { key: "carbs", label: "Carbs", unit: "g", color: "text-foreground" },
  { key: "fat", label: "Fat", unit: "g", color: "text-muted-foreground" },
];

function ProductPage() {
  const { handle } = Route.useParams();
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const cartError = useCartStore((state) => state.error);

  useEffect(() => {
    let active = true;
    void getShopifyProduct(handle)
      .then((item) => { if (active) setProduct(item); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "This meal could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handle]);

  const variant = product?.variants.edges.find(({ node }) => node.availableForSale)?.node;
  const image = product?.images.edges[0]?.node;
  const macros = product ? productMacros(product.tags) : {};

  const handleAdd = async () => {
    if (!product || !variant) return false;
    await addItem({ product, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions });
    if (!useCartStore.getState().error) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Back to the menu</Link>
        {loading ? (
          <div className="grid min-h-[55vh] place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Finding that meal…</div></div>
        ) : error ? (
          <div className="border-y border-border py-20 text-center"><p className="font-display text-2xl font-bold">We couldn’t find this meal.</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button asChild variant="outline" className="mt-5"><Link to="/">Return to the menu</Link></Button></div>
        ) : product ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-secondary">
              {image ? <img src={image.url} alt={image.altText ?? product.title} width={1200} height={900} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground">Meal photo coming soon</div>}
              {productGoal(product.tags) && <span className="absolute left-4 top-4 bg-lime px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground">{productGoal(product.tags)}</span>}
            </div>
            <section className="flex flex-col justify-center py-3 sm:py-6">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-coral"><Leaf className="size-4" /> Made for your next rep</p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">{product.title}</h1>
              <p className="mt-4 text-2xl font-bold">{formatPrice(product.priceRange.minVariantPrice)}</p>
              {product.description && <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">{product.description}</p>}
              <div className="mt-8 border-y border-border py-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em]">Nutrition per meal</p>
                <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {macroInfo.map(({ key, label, unit, color }) => <div key={key}><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-display text-2xl font-bold tabular-nums ${color}`}>{macros[key] ? `${macros[key]}${unit === "kcal" ? "" : ` ${unit}`}` : "—"}</p>{key === "calories" && macros[key] && <span className="text-[10px] text-muted-foreground">kcal</span>}</div>)}
                </div>
              </div>
              <Button disabled={!variant || isLoading} onClick={() => setCustomizeOpen(true)} className="mt-7 h-12 w-full max-w-sm rounded-sm text-sm font-bold uppercase tracking-[0.08em]">
                {added ? <><Check className="size-4" /> Added to cart</> : <><Plus className="size-4" /> Add to cart</>}
              </Button>
              {cartError && <p role="alert" className="mt-3 text-sm text-destructive">{cartError}</p>}
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="size-3.5" /> Checkout securely with Shopify</p>
              {variant && <MealCustomizationDialog open={customizeOpen} onOpenChange={setCustomizeOpen} product={product} variant={variant} adding={isLoading} error={cartError} onAdd={handleAdd} />}
            </section>
          </div>
        ) : (
          <div className="border-y border-border py-20 text-center"><p className="font-display text-2xl font-bold">No meals found.</p><p className="mt-2 text-sm text-muted-foreground">This meal may no longer be on the menu.</p><Button asChild variant="outline" className="mt-5"><Link to="/">Return to the menu</Link></Button></div>
        )}
      </main>
    </div>
  );
}