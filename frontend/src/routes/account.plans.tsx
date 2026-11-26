import { createFileRoute } from "@tanstack/react-router";
import { CustomerSubscriptionsPanel } from "@/components/subscription-plans";

export const Route = createFileRoute("/account/plans")({
  component: CustomerSubscriptionsPanel,
});
