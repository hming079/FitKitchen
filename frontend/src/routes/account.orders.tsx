import { createFileRoute } from "@tanstack/react-router";
import { CustomerOrders } from "@/components/customer-orders";

export const Route = createFileRoute("/account/orders")({
  component: CustomerOrders,
});
