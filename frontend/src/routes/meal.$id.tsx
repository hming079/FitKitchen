import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MenuMealCard } from "@/components/menu-meal-card";
import { goalLabels } from "@/components/menu/meal-display";
import { getLocalMealImage, MenuMealImage } from "@/components/menu/meal-image";
import { MealPreview } from "@/components/menu/meal-preview";
import { StoreHeader } from "@/components/store-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { menuApi, MenuApiError } from "@/lib/menu-api";

export const Route = createFileRoute("/meal/$id")({
  ssr: false,
  loader: async ({ params, abortController }) => {
    if (!/^\d+$/.test(params.id)) return null;

    try {
      return (await menuApi.getMeal(params.id, abortController.signal)).data;
    } catch (error) {
      if (error instanceof MenuApiError && (error.status === 400 || error.status === 404))
        return null;
      throw error;
    }
  },
  head: ({ loaderData: meal }) => ({
    meta: [
      { title: meal ? `${meal.name} | FitFuel Kitchen` : "Meal details | FitFuel Kitchen" },
      {
        name: "description",
        content: meal?.description?.trim() || "Explore the price and nutrition of a FitFuel meal.",
      },
    ],
  }),
  pendingComponent: () => (
    <DetailLayout>
      <p role="status" className="py-16 text-center text-muted-foreground">
        Loading meal…
      </p>
    </DetailLayout>
  ),
  errorComponent: MealError,
  component: MealPage,
});

function DetailLayout({
  children,
  mealName,
}: {
  children: ReactNode;
  mealName?: string | undefined;
}) {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="mx-auto max-w-[1240px] px-5 pb-32 pt-4 sm:px-8 sm:pb-16 lg:px-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/menu" className="flex min-h-11 items-center font-semibold">
                  Menu
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {mealName && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="[overflow-wrap:anywhere]">{mealName}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        {children}
      </main>
    </div>
  );
}

function MealError() {
  const router = useRouter();
  return (
    <DetailLayout>
      <div className="space-y-3 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Could not load this meal.</h1>
        <Button variant="outline" className="min-h-11" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      </div>
    </DetailLayout>
  );
}

function MealPage() {
  const meal = Route.useLoaderData();
  const categories = useQuery({
    queryKey: ["menu", "categories"],
    queryFn: ({ signal }) => menuApi.listCategories(signal),
    enabled: Boolean(meal?.category_id),
    retry: false,
  });
  const category = categories.data?.data.find(({ id }) => id === meal?.category_id);
  const goal = meal?.goal_type;
  const relatedFilters = { goal_type: goal ?? undefined };
  const related = useQuery({
    queryKey: ["menu", "meals", relatedFilters, 1],
    queryFn: ({ signal }) => menuApi.listMeals(relatedFilters, 1, signal),
    enabled: Boolean(goal),
    retry: false,
  });
  const moreMeals = related.data?.data.filter(({ id }) => id !== meal?.id).slice(0, 4) ?? [];

  return (
    <DetailLayout mealName={meal?.name}>
      {meal ? (
        <article className="mt-4 grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
          <MenuMealImage
            key={meal.image_url}
            url={meal.image_url}
            fallbackUrl={getLocalMealImage(meal.name)}
            name={meal.name}
            className="rounded-lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
              {meal.category_id && categories.isError && (
                <p className="text-sm text-muted-foreground">Category unavailable</p>
              )}
              {meal.goal_type && <Badge variant="secondary">{goalLabels[meal.goal_type]}</Badge>}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-4xl">
              {meal.name}
            </h1>
            {meal.is_available !== true && (
              <div className="mt-3">
                <Badge variant="warning">Currently unavailable</Badge>
              </div>
            )}
            {meal.description && (
              <p className="mt-3 whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">
                {meal.description}
              </p>
            )}
            {meal.allergen_info?.trim() && (
              <Alert role="note" variant="warning" className="mt-4">
                <p className="mb-1 font-semibold">Allergens</p>
                <AlertDescription className="whitespace-pre-line [overflow-wrap:anywhere]">
                  {meal.allergen_info}
                </AlertDescription>
              </Alert>
            )}
            <MealPreview key={meal.id} meal={meal} />
          </div>
        </article>
      ) : (
        <h1 className="py-16 text-center font-display text-2xl font-semibold">Meal not found.</h1>
      )}
      {goal && moreMeals.length > 0 && (
        <section aria-labelledby="related-meals" className="mt-12">
          <h2 id="related-meals" className="mb-5 font-display text-2xl font-bold">
            More {goalLabels[goal]} meals
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {moreMeals.map((meal) => (
              <MenuMealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </section>
      )}
    </DetailLayout>
  );
}
