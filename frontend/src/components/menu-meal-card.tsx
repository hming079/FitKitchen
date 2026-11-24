import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Meal } from "@/lib/catalog-api";
import { goalLabels, mealAmount, mealMacros, mealPrice } from "./menu/meal-display";
import { getLocalMealImage, MenuMealImage } from "./menu/meal-image";

export function MenuMealCard({ meal }: { meal: Meal }) {
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
        <Link
          to="/meal/$id"
          params={{ id: meal.id }}
          aria-label={`View meal details for ${meal.name}`}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          View meal <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
