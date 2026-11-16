import chickenMealImage from "@/assets/teriyaki-chicken-meal.jpg";
import beefMealImage from "@/assets/grilled-beef-meal.jpg";
import cutComboImage from "@/assets/cut-combo-meal.jpg";

export interface DemoMeal {
  id: string;
  title: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image: string;
  type: "Meal" | "Combo";
  perks?: string[];
}

export const demoMeals: DemoMeal[] = [
  {
    id: "teriyaki-chicken",
    title: "Teriyaki Chicken Breast & Brown Rice",
    price: 6,
    calories: 450,
    protein: 40,
    carbs: 45,
    fat: 10,
    image: chickenMealImage,
    type: "Meal",
  },
  {
    id: "grilled-beef",
    title: "Grilled Beef Striploin with Asparagus",
    price: 8.5,
    calories: 520,
    protein: 45,
    carbs: 20,
    fat: 25,
    image: beefMealImage,
    type: "Meal",
  },
  {
    id: "seven-day-cut",
    title: "7-Day Cut Combo (Subscription)",
    price: 40,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    image: cutComboImage,
    type: "Combo",
    perks: ["Free Delivery 11:00-12:00", "Daily Macro Tracking"],
  },
];

export const orderStatuses = ["Pending", "Preparing", "Delivering", "Completed"] as const;
export type DemoOrderStatus = (typeof orderStatuses)[number];

export interface DemoOrder {
  id: string;
  customer: string;
  slot: string;
  date: string;
  total: number;
  status: DemoOrderStatus;
}

export const demoOrders: DemoOrder[] = [
  { id: "FF-2841", customer: "Linh Nguyen", slot: "11:00 - 12:00", date: "12 Nov 2026", total: 46, status: "Preparing" },
  { id: "FF-2840", customer: "Marcus Tran", slot: "12:00 - 13:00", date: "12 Nov 2026", total: 14.5, status: "Pending" },
  { id: "FF-2839", customer: "An Pham", slot: "11:00 - 12:00", date: "12 Nov 2026", total: 40, status: "Delivering" },
  { id: "FF-2838", customer: "Jade Le", slot: "17:00 - 18:00", date: "11 Nov 2026", total: 20.5, status: "Completed" },
  { id: "FF-2837", customer: "Minh Vo", slot: "12:00 - 13:00", date: "11 Nov 2026", total: 40, status: "Completed" },
];

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}