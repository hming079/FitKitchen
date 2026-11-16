import { BadgeCheck, Clock3, LockKeyhole, Utensils } from "lucide-react";
import { formatUsd, type DemoMeal } from "@/lib/demo-store";

export function DemoMealCard({ meal }: { meal: DemoMeal }) {
  return (
    <article className="group overflow-hidden border border-border bg-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <img src={meal.image} alt={meal.title} loading="lazy" width={1200} height={912} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 bg-background/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"><Utensils className="size-3" /> {meal.type} · Demo</span>
      </div>
      <div className="px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3"><h3 className="font-display text-lg font-semibold leading-tight">{meal.title}</h3><p className="shrink-0 pt-0.5 text-sm font-bold">{formatUsd(meal.price)}</p></div>
        {meal.type === "Combo" ? (
          <ul className="mt-4 space-y-2 border-y border-border py-3">{meal.perks?.map((perk) => <li key={perk} className="flex items-center gap-2 text-sm"><BadgeCheck className="size-4 shrink-0 text-fresh" /> {perk}</li>)}</ul>
        ) : (
          <div className="mt-4 grid grid-cols-4 divide-x divide-border border-y border-border py-3">{[["Calories", `${meal.calories} kcal`], ["Protein", `${meal.protein}g`], ["Carbs", `${meal.carbs}g`], ["Fat", `${meal.fat}g`]].map(([label, value]) => <div key={label} className="px-1 text-center"><p className="text-xs font-bold tabular-nums">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>)}</div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="size-3.5 shrink-0" /> Sample listing · not available at Shopify checkout</p>
        {meal.type === "Combo" && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> 7-day preview plan</p>}
      </div>
    </article>
  );
}
