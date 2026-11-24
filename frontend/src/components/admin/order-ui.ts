import type { BadgeProps } from "@/components/ui/badge";
import { vnd } from "./catalog/catalog-data";

const kitchenDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatOrderDate(value: string) {
  return kitchenDate.format(new Date(value));
}

export function formatOrderAmount(value: string | number) {
  return vnd.format(Number(value));
}

export function orderStatusLabel(status: string | null) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Unknown";
}

const variants: Record<string, BadgeProps["variant"]> = {
  PENDING: "warning",
  PREPARING: "info",
  DELIVERING: "info",
  COMPLETED: "success",
  CANCELLED: "secondary",
};

export function orderStatusVariant(status: string | null) {
  return variants[status ?? ""] ?? "outline";
}
