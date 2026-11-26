import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { DemoMealCard } from "@/components/demo-meal-card";
import { MenuMealCard } from "@/components/menu-meal-card";
import { goalLabels } from "@/components/menu/meal-display";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { type GoalType } from "@/lib/catalog-api";
import { demoMeals } from "@/lib/demo-store";
import { menuApi, MenuApiError, type NutritionFilters } from "@/lib/menu-api";

const mealGrid = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const goals = ["CUT", "BULK", "MAINTAIN"] as const;
const rangeGroups = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein", label: "Protein (g)" },
] as const;
const sorts = [
  { value: "id", label: "Default" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "protein_desc", label: "Protein: high to low" },
  { value: "calories_asc", label: "Calories: low to high" },
] as const;
const maxPage = 100000;

type MenuSearch = NutritionFilters & {
  goal?: GoalType | undefined;
  search?: string | undefined;
  sort?: (typeof sorts)[number]["value"] | undefined;
  page?: number | undefined;
};

function parseNumber(input: unknown) {
  const value = typeof input === "string" && input.trim() ? Number(input) : input;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function validateSearch(params: Record<string, unknown>): MenuSearch {
  const rawSearch = params["search"];
  const search =
    typeof rawSearch === "string" || typeof rawSearch === "number" || typeof rawSearch === "boolean"
      ? String(rawSearch).replaceAll("\0", "").trim().slice(0, 200)
      : "";
  const page = parseNumber(params["page"]);
  const ranges: NutritionFilters = {};
  for (const { key } of rangeGroups) {
    const lower = parseNumber(params[`min_${key}`]);
    const upper = parseNumber(params[`max_${key}`]);
    if (lower !== undefined && upper !== undefined && lower > upper) continue;
    ranges[`min_${key}`] = lower;
    ranges[`max_${key}`] = upper;
  }
  return {
    ...ranges,
    goal: goals.find((goal) => goal === params["goal"]),
    search: search || undefined,
    sort: sorts.find(({ value }) => value !== "id" && value === params["sort"])?.value,
    page:
      page !== undefined && Number.isInteger(page) && page > 1 && page <= maxPage
        ? page
        : undefined,
  };
}

export const Route = createFileRoute("/menu")({
  validateSearch,
  head: () => ({ meta: [{ title: "Menu | FitFuel Kitchen" }] }),
  component: Menu,
});

function RangeForm({
  ranges,
  apply,
}: {
  ranges: NutritionFilters;
  apply: (ranges: NutritionFilters) => void;
}) {
  const formId = useId();
  const [invalidRange, setInvalidRange] = useState<(typeof rangeGroups)[number]["key"]>();

  function applyRanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: NutritionFilters = {};
    for (const { key } of rangeGroups) {
      const lower = parseNumber(form.get(`min_${key}`));
      const upper = parseNumber(form.get(`max_${key}`));
      if (lower !== undefined && upper !== undefined && lower > upper) {
        setInvalidRange(key);
        return;
      }
      next[`min_${key}`] = lower;
      next[`max_${key}`] = upper;
    }
    setInvalidRange(undefined);
    apply(next);
  }

  return (
    <form onSubmit={applyRanges} className="space-y-3">
      <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
        {rangeGroups.map(({ key, label }) => (
          <fieldset key={key} className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium">{label}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["min", "max"] as const).map((bound) => {
                const name = `${bound}_${key}` as const;
                const id = `${formId}-${name}`;
                return (
                  <div key={name} className="min-w-0 space-y-1">
                    <Label htmlFor={id} className="block text-xs">
                      {bound === "min" ? "Min" : "Max"}
                      <span className="sr-only"> {key}</span>
                    </Label>
                    <Input
                      id={id}
                      name={name}
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={ranges[name]}
                      className="h-11"
                      aria-invalid={invalidRange === key ? true : undefined}
                      aria-describedby={invalidRange === key ? `${formId}-error` : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        <Button type="submit" variant="outline" className="min-h-11">
          Apply ranges
        </Button>
      </div>
      {invalidRange && (
        <p id={`${formId}-error`} role="alert" className="text-sm text-destructive">
          Maximum {invalidRange} must be at least the minimum.
        </p>
      )}
    </form>
  );
}

function Menu() {
  const { goal, search, sort, page = 1, ...ranges } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState({ saved: search, value: search ?? "" });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  if (draft.saved !== search) setDraft({ saved: search, value: search ?? "" });

  useEffect(() => {
    const next = draft.value.trim() || undefined;
    if (next === search) return;
    const timeout = window.setTimeout(() => {
      void navigate({
        search: (current) => ({ ...current, search: next, page: undefined }),
        resetScroll: false,
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [draft.value, navigate, search]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileFiltersOpen(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  const filters = { goal_type: goal, sort, ...(search ? { search } : {}), ...ranges };
  const query = useQuery({
    queryKey: ["menu", "meals", filters, page],
    queryFn: ({ signal }) => menuApi.listMeals(filters, page, signal),
    retry: false,
  });
  const meals = query.data?.data;
  const total = query.data?.pagination.total;
  const lastPage = Math.min(query.data?.pagination.total_pages ?? 0, maxPage);
  const filtered = Boolean(
    goal || search || Object.values(ranges).some((value) => value !== undefined),
  );
  const showSamples =
    page === 1 && !query.data && query.error instanceof MenuApiError && query.error.unavailable;
  const rangeKey = JSON.stringify(ranges);
  const hasRanges = Object.values(ranges).some((value) => value !== undefined);

  function updateFilters(next: MenuSearch) {
    void navigate({
      search: (current) => ({ ...current, ...next, page: undefined }),
      resetScroll: false,
    });
  }

  function clearFilters() {
    setDraft({ saved: search, value: "" });
    void navigate({ search: {}, resetScroll: false });
  }

  const filterLabel = (
    <>
      <SlidersHorizontal className="size-4" aria-hidden /> Filters{hasRanges && " (active)"}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main>
        <section
          aria-labelledby="menu-heading"
          className="mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:px-12"
        >
          <h1 id="menu-heading" className="font-display text-3xl font-bold sm:text-4xl">
            On the menu
          </h1>
          <Collapsible className="sticky top-[72px] z-20 my-5 space-y-3 border-y border-border bg-background py-3 md:py-4">
            <div className="grid items-end gap-2 md:grid-cols-[1fr_auto] md:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="menu-search">Search meals</Label>
                <Input
                  id="menu-search"
                  type="search"
                  value={draft.value}
                  maxLength={200}
                  className="h-11"
                  onChange={(event) => setDraft({ saved: search, value: event.target.value })}
                />
              </div>
              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-sm font-medium">Fitness goal</legend>
                <div className="flex flex-wrap gap-1.5">
                  {[undefined, ...goals].map((option) => (
                    <Button
                      key={option ?? "all"}
                      type="button"
                      variant={goal === option ? "default" : "outline"}
                      aria-pressed={goal === option}
                      onClick={() => updateFilters({ goal: option })}
                      className="min-h-11 flex-1 px-2.5 sm:flex-none sm:px-5"
                    >
                      {option ? goalLabels[option] : "All"}
                    </Button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="hidden min-h-11 md:inline-flex">
                  {filterLabel}
                </Button>
              </CollapsibleTrigger>
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="min-h-11 md:hidden">
                    {filterLabel}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  aria-describedby={undefined}
                  className="max-h-[90dvh] overflow-y-auto"
                >
                  <SheetTitle className="mb-4">Nutrition filters</SheetTitle>
                  <RangeForm
                    key={rangeKey}
                    ranges={ranges}
                    apply={(next) => {
                      updateFilters(next);
                      setMobileFiltersOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2">
                <Label htmlFor="menu-sort" className="sr-only sm:not-sr-only">
                  Sort by
                </Label>
                <Select
                  value={sort ?? "id"}
                  onValueChange={(value) =>
                    updateFilters({
                      sort: sorts.find((option) => option.value === value && value !== "id")?.value,
                    })
                  }
                >
                  <SelectTrigger id="menu-sort" className="h-11 w-40 sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sorts.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CollapsibleContent className="hidden border-t border-border pt-3 md:block">
              <RangeForm key={rangeKey} ranges={ranges} apply={updateFilters} />
            </CollapsibleContent>
          </Collapsible>

          {query.isPending ? (
            <div
              role="status"
              className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground"
            >
              <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
              Loading meals…
            </div>
          ) : !meals ? (
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
                {page > 1 && (
                  <Button asChild variant="ghost" className="min-h-11">
                    <Link to="/menu" search={(current) => ({ ...current, page: undefined })}>
                      First page
                    </Link>
                  </Button>
                )}
              </div>
              {showSamples && (
                <div className={mealGrid}>
                  {demoMeals.map((meal) => (
                    <DemoMealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p role="status" className="text-sm text-muted-foreground">
                  Showing {meals.length} of {total} meals
                </p>
                {meals.length > 0 && (filtered || sort) && (
                  <Button variant="ghost" onClick={clearFilters} className="min-h-11">
                    Clear filters
                  </Button>
                )}
              </div>
              {query.isRefetchError && (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-destructive">
                    Could not refresh the menu.
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
              )}
              {meals.length > 0 ? (
                <div className={mealGrid}>
                  {meals.map((meal) => (
                    <MenuMealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 border-b border-border py-10 text-center text-muted-foreground">
                  <p>
                    {total
                      ? "There are no meals on this page."
                      : filtered
                        ? "No meals match your filters."
                        : "There are no meals on the menu right now."}
                  </p>
                  <Button variant="outline" className="min-h-11" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              )}
              {lastPage > 1 && <MenuPagination page={page} lastPage={lastPage} />}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function MenuPagination({ page, lastPage }: { page: number; lastPage: number }) {
  const current = Math.min(page, lastPage);
  const pages = [...new Set([1, current - 1, current, current + 1, lastPage])]
    .filter((number) => number >= 1 && number <= lastPage)
    .sort((a, b) => a - b);
  return (
    <Pagination aria-label="Menu pages" className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <StepLink target={current - 1} lastPage={lastPage} label="Previous page">
            <ChevronLeft className="size-4" aria-hidden />
          </StepLink>
        </PaginationItem>
        {pages.map((number, index) => (
          <PaginationItem key={number} className="flex items-center">
            {number - (pages[index - 1] ?? number) > 1 && <PaginationEllipsis />}
            <Button
              asChild
              variant={page === number ? "outline" : "ghost"}
              size="icon"
              className="size-11"
            >
              <Link
                to="/menu"
                search={(previous) => ({ ...previous, page: number === 1 ? undefined : number })}
                activeOptions={{ exact: true }}
                aria-current={page === number ? "page" : undefined}
                aria-label={`Page ${number}`}
              >
                {number}
              </Link>
            </Button>
          </PaginationItem>
        ))}
        <PaginationItem>
          <StepLink target={current + 1} lastPage={lastPage} label="Next page">
            <ChevronRight className="size-4" aria-hidden />
          </StepLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function StepLink({
  target,
  lastPage,
  label,
  children,
}: {
  target: number;
  lastPage: number;
  label: string;
  children: ReactNode;
}) {
  if (target < 1 || target > lastPage) {
    return (
      <Button variant="ghost" size="icon" className="size-11" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="icon" className="size-11">
      <Link
        to="/menu"
        search={(previous) => ({ ...previous, page: target === 1 ? undefined : target })}
        aria-current={undefined}
        aria-label={label}
      >
        {children}
      </Link>
    </Button>
  );
}
