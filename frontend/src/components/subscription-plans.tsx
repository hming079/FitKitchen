import { useState } from "react";
import { ArrowRight, CalendarClock, Check, Clock3, Gift, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const perks = [
  { Icon: Clock3, title: "Free delivery in fixed time slots", note: "Fit meals around the workday" },
  { Icon: RefreshCw, title: "Flexible meal swapping", note: "Change the menu to match your week" },
  { Icon: Gift, title: "Free weekend supplements", note: "Whey or protein bars, on us" },
  { Icon: Sparkles, title: "Advanced nutrition analytics", note: "See your intake trends over time" },
];

const plans = [
  { id: "weekly", label: "Weekly", cadence: "7 days", price: "Preview only", detail: "A focused week of better routines" },
  { id: "monthly", label: "Monthly", cadence: "30 days", price: "Preview only", detail: "More consistency, more insight", featured: true },
];

export function SubscriptionPlans() {
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [previewStarted, setPreviewStarted] = useState(false);

  const startPreview = () => {
    window.localStorage.setItem("fitfuel-premium-preview", "active");
    window.localStorage.setItem("fitfuel-premium-plan", selectedPlan);
    setPreviewStarted(true);
  };

  return (
    <section id="plans" className="border-y border-border bg-secondary/60">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-12">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-coral"><Sparkles className="size-4" /> FitFuel Plus</p>
          <h2 className="mt-3 max-w-lg font-display text-4xl font-bold leading-tight sm:text-5xl">Your week, fueled on autopilot.</h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">Premium routines for full calendars. Pick a plan, keep your meals flexible, and make your progress easier to see.</p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <button key={plan.id} type="button" onClick={() => { setSelectedPlan(plan.id); setPreviewStarted(false); }} aria-pressed={selectedPlan === plan.id} className={`relative min-h-36 border p-4 text-left transition-colors ${selectedPlan === plan.id ? "border-primary bg-background" : "border-border bg-card/60 hover:bg-background"}`}>
                {plan.featured && <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-[0.08em] text-fresh">Popular</span>}
                <span className="block text-sm font-semibold">{plan.label} <span className="font-normal text-muted-foreground">· {plan.cadence}</span></span>
                <span className="mt-4 block font-display text-2xl font-bold">{plan.price}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{plan.detail}</span>
                <span className="sr-only">{selectedPlan === plan.id ? "Selected" : "Select plan"}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">No subscription price is set · this preview creates no payment or subscription.</p>
          <Button onClick={startPreview} className="mt-5 h-11 rounded-sm font-bold">{previewStarted ? <><Check className="size-4" /> Analytics preview unlocked</> : <>Preview premium <ArrowRight className="size-4" /></>}</Button>
        </div>

        <div className="grid content-center gap-0 divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-y-0 sm:border-0">
          {perks.map(({ Icon, title, note }, index) => (
            <article key={title} className={`flex gap-4 py-5 sm:px-5 sm:py-6 ${index % 2 === 1 ? "sm:border-l" : ""} ${index >= 2 ? "sm:border-t" : ""} border-border`}>
              <span className="grid size-11 shrink-0 place-items-center bg-background text-fresh"><Icon className="size-5" /></span>
              <div><h3 className="font-semibold leading-snug">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{note}</p></div>
            </article>
          ))}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 sm:px-5"><CalendarClock className="size-4 text-coral" /> Choose a delivery rhythm that works around your day.</div>
        </div>
      </div>
    </section>
  );
}