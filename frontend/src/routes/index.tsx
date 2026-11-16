import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Check, Leaf, LoaderCircle, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import heroImage from "@/assets/fitfuel-meal-hero.jpg";
import { MealCard } from "@/components/meal-card";
import { DemoMealCard } from "@/components/demo-meal-card";
import { demoMeals } from "@/lib/demo-store";
import { SubscriptionPlans } from "@/components/subscription-plans";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { getShopifyProducts, productGoal, type ShopifyProduct } from "@/lib/shopify";

type Goal = "Bulk" | "Cut" | "Maintain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitFuel Kitchen | Meals made for your next rep" },
      { name: "description", content: "Find your next go-to meal: fresh, chef-made fuel for bulking, cutting, or keeping your routine steady." },
      { property: "og:title", content: "FitFuel Kitchen | Meals made for your next rep" },
      { property: "og:description", content: "Fresh, chef-made fuel for every fitness goal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [goal, setGoal] = useState<Goal>("Maintain");
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getShopifyProducts()
      .then((items) => { if (active) setProducts(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Meals could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => {
    const goalProducts = products.filter((product) => productGoal(product.tags) === goal);
    return goalProducts.length > 0 ? goalProducts : products;
  }, [goal, products]);

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main>
        <section className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-8 lg:px-12">
          <div className="relative isolate min-h-[540px] overflow-hidden rounded-sm bg-primary md:min-h-[590px]">
            <img src={heroImage} alt="A balanced FitFuel meal with grilled chicken, quinoa, broccoli, and sweet potato" width={1536} height={1024} fetchPriority="high" className="absolute inset-0 -z-20 size-full object-cover object-[60%_52%]" />
            <div className="absolute inset-0 -z-10 bg-foreground/50 md:bg-foreground/40" />
            <div className="flex min-h-[540px] max-w-[700px] flex-col items-start justify-center px-6 py-12 text-primary-foreground sm:px-12 md:min-h-[590px] md:px-16 lg:px-20">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-lime"><Sparkles className="size-4" /> Good food. Strong days.</p>
              <h1 className="max-w-xl font-display text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-[72px]">Good food.<br /><span className="text-lime">Strong days.</span></h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/85 sm:text-lg">Chef-made meal prep that keeps your goals in sight and your fridge full of good decisions.</p>
              <a href="#menu" className="mt-8 inline-flex h-12 items-center gap-3 rounded-sm bg-lime px-5 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5">Find your fuel <ArrowRight className="size-4" /></a>
              <p className="mt-7 flex items-center gap-2 text-xs text-primary-foreground/75"><PackageCheck className="size-4" /> Freshly prepared · delivered to your door</p>
            </div>
            <span className="absolute bottom-5 right-6 hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/80 lg:flex"><ArrowDown className="size-4" /> Your next great meal</span>
          </div>
        </section>

        <section id="menu" className="mx-auto max-w-[1440px] px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:px-12 lg:pb-24">
          <div className="flex flex-col justify-between gap-8 border-b border-border pb-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">Your training, your table</p>
              <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Choose your <span className="text-coral">fuel.</span></h2>
              <p className="mt-3 max-w-lg text-muted-foreground">Every goal gets a good meal. What are you working toward?</p>
            </div>
            <div className="flex w-full max-w-[420px] border border-border bg-card p-1 sm:w-auto" aria-label="Select your fitness goal">
              {(["Bulk", "Cut", "Maintain"] as const).map((option) => (
                <Button key={option} variant="ghost" aria-pressed={goal === option} onClick={() => setGoal(option)} className={`h-10 flex-1 rounded-sm px-4 text-sm sm:min-w-28 ${goal === option ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}`}>{option}</Button>
              ))}
            </div>
          </div>

          <div className="mb-6 mt-8 flex items-end justify-between gap-4">
            <div><p className="font-display text-2xl font-bold">On the menu</p><p className="mt-1 text-sm text-muted-foreground">Made fresh. Ready when you are.</p></div>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:block">Goal: {goal}</span>
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Setting the table…</div></div>
          ) : error ? (
            <>
              <div className="mb-5 border-y border-border py-5"><p className="font-display text-xl font-semibold">Live menu unavailable</p><p className="mt-2 text-sm text-muted-foreground">{error} Sample meal previews are shown below.</p></div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{demoMeals.map((meal) => <DemoMealCard key={meal.id} meal={meal} />)}</div>
            </>
          ) : (
            <>
              {visibleProducts.length === 0 && <p className="mb-4 text-sm text-muted-foreground">Live menu is empty · showing sample meal previews below.</p>}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleProducts.map((product) => <MealCard key={product.id} product={product} />)}
                {demoMeals.map((meal) => <DemoMealCard key={meal.id} meal={meal} />)}
              </div>
            </>
          )}
        </section>

        <SubscriptionPlans />

        <section className="border-y border-border bg-secondary/65">
          <div className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:grid-cols-3 sm:px-8 lg:px-12">
            {[
              { icon: Leaf, title: "Ingredients with intention", copy: "Real food, chosen with care." },
              { icon: Check, title: "Macros made clear", copy: "Know what’s on your plate." },
              { icon: ShieldCheck, title: "Ready when you are", copy: "Fresh meals, no guesswork." },
            ].map(({ icon: Icon, title, copy }) => <div key={title} className="flex items-center gap-4 border-b border-border py-6 last:border-0 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0 lg:py-8"><span className="grid size-11 shrink-0 place-items-center rounded-sm bg-background"><Icon className="size-5 text-fresh" /></span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{copy}</p></div></div>)}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span className="font-display text-base font-bold text-foreground">fitfuel<span className="text-coral">.</span></span><span>Good food for your next great thing.</span><Link to="/dashboard" className="font-semibold text-foreground hover:text-coral">Your fuel tracker <ArrowRight className="inline size-3.5" /></Link></footer>
      <div className="sr-only" aria-live="polite">{loading ? "Loading meal catalog" : "Meal catalog loaded"}</div>
    </div>
  );
}