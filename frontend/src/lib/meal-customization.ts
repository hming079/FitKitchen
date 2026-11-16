import type { ShopifyPrice } from "@/lib/shopify";

export interface MealAddon {
  id: "chicken" | "beef";
  name: string;
  portion: string;
  price: number;
  calories: number;
  protein: number;
}

export const mealAddons: MealAddon[] = [
  { id: "chicken", name: "Chicken breast", portion: "+50g", price: 25000, calories: 82, protein: 14 },
  { id: "beef", name: "Beef", portion: "+100g", price: 35000, calories: 120, protein: 20 },
];

export function calculateCustomization(basePrice: ShopifyPrice, baseCalories: string | undefined, baseProtein: string | undefined, selectedIds: string[]) {
  const selected = mealAddons.filter((addon) => selectedIds.includes(addon.id));
  return {
    price: Number(basePrice.amount) + selected.reduce((sum, addon) => sum + addon.price, 0),
    calories: baseCalories ? Number(baseCalories) + selected.reduce((sum, addon) => sum + addon.calories, 0) : null,
    protein: baseProtein ? Number(baseProtein) + selected.reduce((sum, addon) => sum + addon.protein, 0) : null,
  };
}

export function formatEstimatedPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}