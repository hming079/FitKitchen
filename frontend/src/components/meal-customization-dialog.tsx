import { useMemo, useState } from "react";
import { Check, Dumbbell, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateCustomization, formatEstimatedPrice, mealAddons } from "@/lib/meal-customization";
import { productMacros, type ShopifyProduct, type ShopifyVariant } from "@/lib/shopify";

interface MealCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopifyProduct;
  variant: ShopifyVariant;
  adding: boolean;
  error: string | null;
  onAdd: () => Promise<boolean>;
}

export function MealCustomizationDialog({ open, onOpenChange, product, variant, adding, error, onAdd }: MealCustomizationDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const macros = productMacros(product.tags);
  const baseCalories = macros["calories"];
  const baseProtein = macros["protein"];
  const estimate = useMemo(
    () => calculateCustomization(variant.price, baseCalories, baseProtein, selected),
    [baseCalories, baseProtein, selected, variant.price],
  );

  const toggleAddon = (id: string, checked: boolean) => {
    setSelected((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  };

  const handleAdd = async () => {
    const added = await onAdd();
    if (added) {
      setSelected([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-6 text-left">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-coral"><Dumbbell className="size-4" /> Make it yours</p>
        <DialogTitle className="font-display text-2xl">Upsize your <span className="block">{product.title}</span></DialogTitle>
          <DialogDescription>Build a bigger plate and see your nutrition estimate update instantly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mealAddons.map((addon) => {
            const checked = selected.includes(addon.id);
            return (
              <label key={addon.id} className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${checked ? "border-fresh bg-secondary/60" : "border-border bg-card"}`}>
                <Checkbox checked={checked} onCheckedChange={(value) => toggleAddon(addon.id, value === true)} aria-label={`Add ${addon.portion} ${addon.name}`} />
                <span className="grid size-10 shrink-0 place-items-center bg-secondary text-fresh"><Plus className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{addon.portion} {addon.name}</span><span className="mt-1 block text-xs text-muted-foreground">+{addon.calories} kcal · +{addon.protein}g protein</span></span>
                <span className="shrink-0 text-sm font-bold">+{formatEstimatedPrice(addon.price, variant.price.currencyCode)}</span>
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 border-y border-border py-4">
          <div><p className="text-xs text-muted-foreground">Estimated calories</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{estimate.calories === null ? "—" : `${estimate.calories} kcal`}</p></div>
          <div><p className="text-xs text-muted-foreground">Estimated protein</p><p className="mt-1 font-display text-xl font-bold tabular-nums">{estimate.protein === null ? "—" : `${estimate.protein}g`}</p></div>
        </div>
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Estimated total</p><p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatEstimatedPrice(estimate.price, variant.price.currencyCode)}</p></div><span className="flex items-center gap-1 text-xs font-semibold text-fresh"><Sparkles className="size-3.5" /> Live estimate</span></div>
        <p className="text-xs leading-relaxed text-muted-foreground">Preview only: add-ons are not charged or included in Shopify checkout. Only the base meal will be added to your bag.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="sm:justify-start">
          <Button disabled={adding} onClick={() => void handleAdd()} className="h-11 w-full rounded-sm font-bold sm:w-auto"><Check className="size-4" /> Add base meal to cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}