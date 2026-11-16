import { describe, expect, it } from "vitest";
import { calculateCustomization, mealAddons } from "@/lib/meal-customization";
import { demoMeals, orderStatuses } from "@/lib/demo-store";

describe("meal customization estimates", () => {
  it("updates price, calories, and protein for the selected chicken and beef portions", () => {
    const result = calculateCustomization(
      { amount: "120000", currencyCode: "VND" },
      "500",
      "35",
      mealAddons.map(({ id }) => id),
    );

    expect(result).toEqual({ price: 180000, calories: 702, protein: 69 });
  });

  it("leaves the base meal totals unchanged with no add-ons", () => {
    expect(calculateCustomization({ amount: "120000", currencyCode: "VND" }, "500", "35", [])).toEqual({
      price: 120000,
      calories: 500,
      protein: 35,
    });
  });

  it("keeps the three requested demo meals and their exact USD prices and macros", () => {
    expect(demoMeals.map(({ title, price, calories, protein, carbs, fat }) => ({ title, price, calories, protein, carbs, fat }))).toEqual([
      { title: "Teriyaki Chicken Breast & Brown Rice", price: 6, calories: 450, protein: 40, carbs: 45, fat: 10 },
      { title: "Grilled Beef Striploin with Asparagus", price: 8.5, calories: 520, protein: 45, carbs: 20, fat: 25 },
      { title: "7-Day Cut Combo (Subscription)", price: 40, calories: 0, protein: 0, carbs: 0, fat: 0 },
    ]);
  });

  it("uses the four requested order statuses", () => {
    expect(orderStatuses).toEqual(["Pending", "Preparing", "Delivering", "Completed"]);
  });
});