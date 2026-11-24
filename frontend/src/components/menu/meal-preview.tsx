import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Meal } from "@/lib/catalog-api";
import { menuApi } from "@/lib/menu-api";
import { mealAmount, mealMacros, mealPrice } from "./meal-display";
import { useCartStore } from "@/stores/cart-store";

const measures = [{ key: "price", label: "Price", unit: "" }, ...mealMacros] as const;

function formatMeasure(value: number, unit: string) {
  return unit ? `${mealAmount.format(value)} ${unit}` : mealPrice.format(value);
}

export function MealPreview({ meal }: { meal: Meal }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const adding = useCartStore((state) => state.isLoading);
  const cartError = useCartStore((state) => state.error);
  const query = useQuery({
    queryKey: ["menu", "options", meal.id],
    queryFn: ({ signal }) => menuApi.listOptions(meal.id, signal),
    enabled: meal.is_available === true,
    retry: false,
  });
  const options =
    meal.is_available === true
      ? (query.data?.data.filter((option) => option.is_available === true) ?? [])
      : [];
  const chosen = options.filter((option) => selected.has(option.id));
  const totals = measures.map(({ key, label, unit }) => ({
    key,
    label,
    original: formatMeasure(meal[key], unit),
    customized: formatMeasure(
      Math.max(
        0,
        chosen.reduce((total, option) => total + option[`${key}_adjustment`], meal[key]),
      ),
      unit,
    ),
  }));

  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="meal-nutrition">
        <h2 id="meal-nutrition" className="mb-2 font-display text-xl font-semibold">
          Price and nutrition
        </h2>
        <div className="rounded-lg border border-border bg-card text-card-foreground">
          <Table aria-labelledby="meal-nutrition" className="tabular-nums">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead scope="col" className="pl-3">
                  Per meal
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Original
                </TableHead>
                {options.length > 0 && (
                  <TableHead scope="col" className="pr-3 text-right">
                    Customized
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.map(({ key, label, original, customized }) => (
                <TableRow key={key}>
                  <th scope="row" className="py-2 pl-3 text-left font-medium">
                    {label}
                  </th>
                  <TableCell className="whitespace-nowrap pr-3 text-right">{original}</TableCell>
                  {options.length > 0 && (
                    <TableCell className="whitespace-nowrap pr-3 text-right font-semibold">
                      {customized}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {options.length > 0 && (
          <p role="status" className="sr-only">
            Customized per meal.{" "}
            {totals.map(({ label, customized }) => `${label} ${customized}`).join(", ")}
          </p>
        )}
      </section>
      {meal.is_available === true && (
        <section aria-labelledby="meal-options">
          <h2 id="meal-options" className="font-display text-xl font-semibold">
            Customize your portion
          </h2>
          {query.isPending && (
            <p role="status" className="mt-2 text-sm">
              Loading options…
            </p>
          )}
          {query.isError && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-destructive">
                Could not load options.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {query.isSuccess && options.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No customization options for this meal.
            </p>
          )}
          {options.length > 0 && (
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {options.map((option) => {
                const inputId = `meal-option-${option.id}`;
                return (
                  <li key={option.id} className="py-1">
                    <Label
                      htmlFor={inputId}
                      className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5"
                    >
                      <Checkbox
                        id={inputId}
                        aria-labelledby={`${inputId}-name`}
                        aria-describedby={option.description ? `${inputId}-description` : undefined}
                        className="mt-0.5 size-5"
                        checked={selected.has(option.id)}
                        onCheckedChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (checked === true) next.add(option.id);
                            else next.delete(option.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span id={`${inputId}-name`} className="block text-base font-medium">
                          {option.name}
                        </span>
                        {option.description && (
                          <span
                            id={`${inputId}-description`}
                            className="mt-1 block font-normal text-muted-foreground"
                          >
                            {option.description}
                          </span>
                        )}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <div className="space-y-2">
        <Button
          disabled={meal.is_available !== true || adding || query.isPending || query.isError}
          aria-describedby="meal-ordering-note"
          className="min-h-11 w-full sm:w-auto"
          onClick={async () => {
            const success = await addItem(meal.id, [...selected]);
            if (success) {
              setAdded(true);
              window.setTimeout(() => setAdded(false), 1400);
            }
          }}
        >
          {adding ? "Adding…" : added ? "Added to cart" : "Add to cart"}
        </Button>
        {(cartError || !meal.is_available) && (
          <p role="alert" className="text-sm text-destructive">
            {cartError || "This meal is not available to order."}
          </p>
        )}
        <p id="meal-ordering-note" className="text-sm text-muted-foreground">
          Sign in with a customer account to save your cart and place an order.
        </p>
      </div>
    </div>
  );
}
