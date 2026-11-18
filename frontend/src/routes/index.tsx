import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Leaf,
  LoaderCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import heroImage from "@/assets/fitfuel-meal-hero.jpg";
import { DemoMealCard } from "@/components/demo-meal-card";
import { MenuMealCard } from "@/components/menu-meal-card";
import { goalLabels } from "@/components/menu/meal-display";
import { demoMeals } from "@/lib/demo-store";
import { SubscriptionPlans } from "@/components/subscription-plans";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goalTypes, type GoalType } from "@/lib/catalog-api";
import { menuApi, MenuApiError, type NutritionFilters } from "@/lib/menu-api";

const mealGrid = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const rangeGroups = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein", label: "Protein (g)" },
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

function Menu() {
  const [goal, setGoal] = useState<GoalType | undefined>();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [ranges, setRanges] = useState<NutritionFilters>({});
  const [invalidRange, setInvalidRange] = useState<(typeof rangeGroups)[number]["key"]>();
  const rangeForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const next = input.trim();
    if (next === search) return;
    const timeout = window.setTimeout(() => setSearch(next), 300);
    return () => window.clearTimeout(timeout);
  }, [input, search]);

  const filters = { goal_type: goal, search, ...ranges };
  const query = useInfiniteQuery({
    queryKey: ["menu", "meals", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => menuApi.listMeals(filters, pageParam, signal),
    getNextPageParam: ({ pagination }) =>
      pagination.page < Math.min(pagination.total_pages, 100000) ? pagination.page + 1 : undefined,
    retry: false,
  });
  const meals = new Map(
    query.data?.pages.flatMap(({ data }) => data.map((meal) => [meal.id, meal] as const)),
  );
  const filtered = Boolean(
    goal || search || Object.values(ranges).some((value) => value !== undefined),
  );
  const showSamples = !query.data && query.error instanceof MenuApiError && query.error.unavailable;

  function clearFilters() {
    rangeForm.current?.reset();
    setGoal(undefined);
    setInput("");
    setSearch("");
    setRanges({});
    setInvalidRange(undefined);
  }

  function applyRanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: NutritionFilters = {};
    for (const { key } of rangeGroups) {
      const min = form.get(`min_${key}`);
      const max = form.get(`max_${key}`);
      const lower = min ? Number(min) : undefined;
      const upper = max ? Number(max) : undefined;
      if (lower !== undefined && upper !== undefined && lower > upper) {
        setInvalidRange(key);
        return;
      }
      next[`min_${key}`] = lower;
      next[`max_${key}`] = upper;
    }
    setInvalidRange(undefined);
    setRanges(next);
  }

  return (
    <section
      id="menu"
      aria-labelledby="menu-heading"
      className="mx-auto max-w-[1440px] scroll-mt-20 px-5 pb-16 pt-12 sm:px-8 lg:px-12 lg:pb-24"
    >
      <h2 id="menu-heading" className="font-display text-3xl font-bold sm:text-4xl">
        On the menu
      </h2>
      <div className="my-5 space-y-4 border-y border-border py-4">
        <div className="grid items-end gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="menu-search">Search meals</Label>
            <Input
              id="menu-search"
              type="search"
              value={input}
              maxLength={200}
              className="h-11"
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium">Fitness goal</legend>
            <div className="flex flex-wrap gap-1.5">
              {[undefined, ...goalTypes].map((option) => (
                <Button
                  key={option ?? "all"}
                  type="button"
                  variant={goal === option ? "default" : "outline"}
                  aria-pressed={goal === option}
                  onClick={() => setGoal(option)}
                  className="min-h-11 flex-1 px-2.5 sm:flex-none sm:px-5"
                >
                  {option ? goalLabels[option] : "All"}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
        <form ref={rangeForm} onSubmit={applyRanges} className="space-y-2">
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
            {rangeGroups.map(({ key, label }) => (
              <fieldset key={key} className="min-w-0">
                <legend className="mb-1.5 text-sm font-medium">{label}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["min", "max"] as const).map((bound) => {
                    const name = `${bound}_${key}`;
                    return (
                      <div key={name} className="min-w-0 space-y-1">
                        <Label htmlFor={name} className="block text-xs">
                          {bound === "min" ? "Min" : "Max"}
                          <span className="sr-only"> {key}</span>
                        </Label>
                        <Input
                          id={name}
                          name={name}
                          type="number"
                          min={0}
                          step="any"
                          className="h-11 px-2"
                          aria-invalid={invalidRange === key ? true : undefined}
                          aria-describedby={invalidRange === key ? "menu-range-error" : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <div className="col-span-2 flex flex-wrap gap-2 md:col-span-1">
              <Button type="submit" variant="outline" className="min-h-11">
                Apply ranges
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
          {invalidRange && (
            <p id="menu-range-error" role="alert" className="text-sm text-destructive">
              Maximum {invalidRange} must be at least the minimum.
            </p>
          )}
        </form>
      </div>

      {query.isPending ? (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground"
        >
          <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
          Loading meals…
        </div>
      ) : !query.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-muted-foreground">
              {showSamples
                ? "Live menu unavailable. Sample previews are shown below."
                : "Could not load meals."}
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
          {showSamples && (
            <div className={mealGrid}>
              {demoMeals.map((meal) => (
                <DemoMealCard key={meal.id} meal={meal} />
              ))}
            </div>
          )}
        </div>
      ) : meals.size === 0 ? (
        <p role="status" className="border-b border-border py-10 text-center text-muted-foreground">
          {filtered ? "No meals match your filters." : "There are no meals on the menu right now."}
        </p>
      ) : (
        <>
          <div className={mealGrid}>
            {[...meals.values()].map((meal) => (
              <MenuMealCard key={meal.id} meal={meal} />
            ))}
          </div>
          {(query.hasNextPage || query.isError) && (
            <div className="mt-5 flex flex-col items-center gap-2">
              {query.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {query.isFetchNextPageError
                    ? "Could not load more meals."
                    : "Could not refresh the menu."}
                </p>
              )}
              {query.isRefetchError ? (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Try again
                </Button>
              ) : (
                query.hasNextPage && (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={query.isFetching}
                    onClick={() => void query.fetchNextPage({ cancelRefetch: false })}
                  >
                    {query.isFetchingNextPage ? "Loading more…" : "Load more"}
                  </Button>
                )
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function HomePage() {
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
              <a
                href="#menu"
                className="mt-8 inline-flex h-12 items-center gap-3 rounded-sm bg-lime px-5 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Find your fuel <ArrowRight className="size-4" />
              </a>
              <p className="mt-7 flex items-center gap-2 text-xs text-primary-foreground/75">
                <PackageCheck className="size-4" /> Freshly prepared · delivered to your door
              </p>
            </div>
            <span className="absolute bottom-5 right-6 hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/80 lg:flex">
              <ArrowDown className="size-4" /> Your next great meal
            </span>
          </div>
        </section>

        <Menu />

        <SubscriptionPlans />

        <section className="border-y border-border bg-secondary/65">
          <div className="mx-auto grid max-w-[1440px] gap-0 px-5 sm:grid-cols-3 sm:px-8 lg:px-12">
            {[
              {
                icon: Leaf,
                title: "Ingredients with intention",
                copy: "Real food, chosen with care.",
              },
              { icon: Check, title: "Macros made clear", copy: "Know what’s on your plate." },
              {
                icon: ShieldCheck,
                title: "Ready when you are",
                copy: "Fresh meals, no guesswork.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="flex items-center gap-4 border-b border-border py-6 last:border-0 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0 lg:py-8"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-background">
                  <Icon className="size-5 text-fresh" />
                </span>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span className="font-display text-base font-bold text-foreground">
          fitfuel<span className="text-coral">.</span>
        </span>
        <span>Good food for your next great thing.</span>
        <Link to="/dashboard" className="font-semibold text-foreground hover:text-coral">
          Your fuel tracker <ArrowRight className="inline size-3.5" />
        </Link>
      </footer>
    </div>
  );
}
