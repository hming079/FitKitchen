import { createFileRoute } from "@tanstack/react-router";
import { StoreHeader } from "@/components/store-header";
import { SubscriptionPlans } from "@/components/subscription-plans";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Meal Plans | FitFuel Kitchen" }] }),
  component: PlansPage,
});

function PlansPage() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main>
        <div className="mx-auto max-w-[1440px] px-5 pb-6 pt-12 sm:px-8 lg:px-12">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Meal plans</h1>
        </div>
        <SubscriptionPlans />
      </main>
    </div>
  );
}
