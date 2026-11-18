import type { GoalType } from "@/lib/catalog-api";

export const goalLabels: Record<GoalType, string> = {
  BULK: "Bulk",
  CUT: "Cut",
  MAINTAIN: "Maintain",
};

export const mealMacros = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
] as const;

export const mealAmount = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
export const mealPrice = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 2,
});
