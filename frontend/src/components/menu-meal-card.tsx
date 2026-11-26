import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import type { Meal } from "@/lib/catalog-api";
import { useCartStore } from "@/stores/cart-store";
import { goalLabels, mealAmount, mealMacros, mealPrice } from "./menu/meal-display";
import { getLocalMealImage, MenuMealImage } from "./menu/meal-image";

export function MenuMealCard({ meal }: { meal: Meal }) {
  const [added, setAdded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const signInLink = useRef<HTMLAnchorElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(0), 1300);
    return () => window.clearTimeout(timer);
  }, [added]);

  useEffect(() => {
    if (needsSignIn) signInLink.current?.focus();
  }, [needsSignIn]);

  async function handleQuickAdd() {
    setError(null);
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      setNeedsSignIn(true);
      return;
    }
    const success = await addItem(meal.id);
    if (success) {
      setAdded((count) => count + 1);
    } else {
      setError(useCartStore.getState().error ?? "Could not add this meal.");
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <MenuMealImage
        key={meal.image_url}
        url={meal.image_url}
        fallbackUrl={getLocalMealImage(meal.name)}
        name={meal.name}
        lazy
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        {meal.goal_type && (
          <Badge variant="secondary" className="self-start">
            {goalLabels[meal.goal_type]}
          </Badge>
        )}
        <h3 className="font-display text-lg font-semibold leading-tight [overflow-wrap:anywhere]">
          {meal.name}
        </h3>
        <p className="font-semibold tabular-nums">{mealPrice.format(meal.price)}</p>
        <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-border pt-3">
          {mealMacros.map(({ key, label, unit }) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                {mealAmount.format(meal[key])} {unit}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/meal/$id"
            params={{ id: meal.id }}
            aria-label={`View meal details for ${meal.name}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            View meal <ArrowRight className="size-4" aria-hidden />
          </Link>
          {needsSignIn ? (
            <Button asChild size="sm" className="min-h-11 px-3">
              <Link ref={signInLink} to="/login" aria-label={`Sign in to add: ${meal.name}`}>
                Sign in to add
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="min-h-11 gap-1.5 px-3"
              disabled={meal.is_available !== true || isLoading}
              onClick={() => void handleQuickAdd()}
              aria-label={`${added ? "Added" : "Add to cart"}: ${meal.name}`}
            >
              {added ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              {added ? "Added" : "Add to cart"}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
