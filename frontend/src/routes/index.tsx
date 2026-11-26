import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  CookingPot,
  PackageCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import heroImage from "@/assets/fitfuel-meal-hero.jpg";
import { MenuMealCard } from "@/components/menu-meal-card";
import { goalLabels } from "@/components/menu/meal-display";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { menuApi } from "@/lib/menu-api";

const goals = [
  { goal: "CUT", copy: "Lighter meals for your cutting phase." },
  { goal: "BULK", copy: "Heartier portions to fuel your bulk." },
  { goal: "MAINTAIN", copy: "Balanced meals for your everyday routine." },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitFuel Kitchen | Meals made for your next rep" },
      {
        name: "description",
        content:
          "Find your next go-to meal: fresh, chef-made fuel for bulking, cutting, or keeping your routine steady.",
      },
      { property: "og:title", content: "FitFuel Kitchen | Meals made for your next rep" },
      { property: "og:description", content: "Fresh, chef-made fuel for every fitness goal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const featured = useQuery({
    queryKey: ["menu", "meals", {}, 1],
    queryFn: ({ signal }) => menuApi.listMeals({}, 1, signal),
    retry: false,
  });
  const meals = featured.data?.data.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main>
        <section className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-8 lg:px-12">
          <div className="relative isolate min-h-[540px] overflow-hidden rounded-sm bg-primary md:min-h-[590px]">
            <img
              src={heroImage}
              alt="A balanced FitFuel meal with grilled chicken, quinoa, broccoli, and sweet potato"
              width={1536}
              height={1024}
              fetchPriority="high"
              className="absolute inset-0 -z-20 size-full object-cover object-[60%_52%]"
            />
            <div className="absolute inset-0 -z-10 bg-foreground/50 md:bg-foreground/40" />
            <div className="flex min-h-[540px] max-w-[700px] flex-col items-start justify-center px-6 py-12 text-primary-foreground sm:px-12 md:min-h-[590px] md:px-16 lg:px-20">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-lime">
                <Sparkles className="size-4" /> Good food. Strong days.
              </p>
              <h1 className="max-w-xl font-display text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-[72px]">
                Good food.
                <br />
                <span className="text-lime">Strong days.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
                Chef-made meal prep that keeps your goals in sight and your fridge full of good
                decisions.
              </p>
              <Link
                to="/menu"
                className="mt-8 inline-flex h-12 items-center gap-3 rounded-sm bg-lime px-5 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Browse the menu <ArrowRight className="size-4" />
              </Link>
              <p className="mt-7 flex items-center gap-2 text-xs text-primary-foreground/75">
                <PackageCheck className="size-4" /> Freshly prepared · delivered to your door
              </p>
            </div>
            <span className="absolute bottom-5 right-6 hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/80 lg:flex">
              <ArrowDown className="size-4" /> Your next great meal
            </span>
          </div>
        </section>

        <section
          aria-labelledby="shop-by-goal"
          className="mx-auto max-w-[1440px] px-5 pt-12 sm:px-8 lg:px-12"
        >
          <h2 id="shop-by-goal" className="font-display text-3xl font-bold sm:text-4xl">
            Shop by goal
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {goals.map(({ goal, copy }) => (
              <Link
                key={goal}
                to="/menu"
                search={{ goal }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <div>
                  <h3 className="font-display text-lg font-semibold">{goalLabels[goal]}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </div>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <section
          id="menu"
          aria-labelledby="featured-meals"
          className="mx-auto max-w-[1440px] scroll-mt-20 px-5 py-12 sm:px-8 lg:px-12 lg:pb-16"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
            <h2 id="featured-meals" className="font-display text-3xl font-bold sm:text-4xl">
              Featured meals
            </h2>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/menu">
                {featured.data
                  ? `See all ${featured.data.pagination.total} meals`
                  : "See the full menu"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          {meals.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {meals.map((meal) => (
                <MenuMealCard key={meal.id} meal={meal} />
              ))}
            </div>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {featured.isPending
                ? "Loading meals…"
                : featured.isError
                  ? "Could not load featured meals."
                  : "There are no meals on the menu right now."}
            </p>
          )}
        </section>

        <section aria-labelledby="how-it-works" className="border-y border-border bg-secondary/65">
          <div className="mx-auto max-w-[1440px] px-5 pt-8 sm:px-8 lg:px-12">
            <h2 id="how-it-works" className="font-display text-3xl font-bold sm:text-4xl">
              How it works
            </h2>
          </div>
          <ol className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:grid-cols-3 sm:px-8 lg:px-12">
            {[
              {
                icon: Utensils,
                title: "Choose your meals",
                copy: "Pick the meals that fit your goals.",
              },
              {
                icon: CalendarDays,
                title: "Choose your delivery date",
                copy: "Plan for the day that works for you.",
              },
              {
                icon: CookingPot,
                title: "Heat and eat",
                copy: "Warm up your meal when you’re ready.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <li
                key={title}
                className="flex items-center gap-4 border-b border-border py-6 last:border-0 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0 lg:py-8"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-background">
                  <Icon className="size-5 text-fresh" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="plans"
          aria-labelledby="plans-summary"
          className="mx-auto flex max-w-[1440px] scroll-mt-20 flex-wrap items-center justify-between gap-5 px-5 py-12 sm:px-8 lg:px-12"
        >
          <div>
            <h2 id="plans-summary" className="font-display text-3xl font-bold sm:text-4xl">
              Meal plans
            </h2>
            <p className="mt-2 text-muted-foreground">
              Keep your routine on track with a 7-day or 30-day meal plan.
            </p>
          </div>
          <Button asChild className="min-h-11">
            <Link to="/plans">
              Compare plans <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span className="font-display text-base font-bold text-foreground">
          fitfuel<span className="text-coral">.</span>
        </span>
        <span>Good food for your next great thing.</span>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-4 font-semibold text-foreground"
        >
          <Link to="/menu" className="py-2 hover:text-coral">
            Menu
          </Link>
          <Link to="/plans" className="py-2 hover:text-coral">
            Plans
          </Link>
          <Link to="/nutrition" className="py-2 hover:text-coral">
            Nutrition
          </Link>
          <Link to="/account/tracker" className="py-2 hover:text-coral">
            Your fuel tracker <ArrowRight className="inline size-3.5" aria-hidden />
          </Link>
        </nav>
      </footer>
    </div>
  );
}
