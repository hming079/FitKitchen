import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, Check, CircleHelp, Droplets, Flame, LockKeyhole, Sparkles, Target, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { CustomerAccess } from "@/components/customer-access";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Fuel Tracker | FitFuel Kitchen" },
      { name: "description", content: "See your daily calories, protein, carbs, and fat alongside your goal targets." },
      { property: "og:title", content: "Your Fuel Tracker | FitFuel Kitchen" },
      { property: "og:description", content: "A clear look at today's macro balance and nutrition targets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const macros = [
  { label: "Calories", unit: "kcal", consumed: 1470, target: 2100, percent: 70, color: "bg-coral", marker: "bg-coral", Icon: Flame },
  { label: "Protein", unit: "g", consumed: 112, target: 150, percent: 75, color: "bg-fresh", marker: "bg-fresh", Icon: Target },
  { label: "Carbs", unit: "g", consumed: 158, target: 220, percent: 72, color: "bg-lime", marker: "bg-lime", Icon: UtensilsCrossed },
  { label: "Fat", unit: "g", consumed: 48, target: 65, percent: 74, color: "bg-primary", marker: "bg-primary", Icon: Droplets },
];

type AnalyticsMacro = "calories" | "protein" | "carbs" | "fat";
type AnalyticsPeriod = "week" | "month";

const analyticsData: Record<AnalyticsPeriod, Record<AnalyticsMacro, number[]>> = {
  week: {
    calories: [1840, 2010, 1760, 2180, 1950, 2080, 1470],
    protein: [126, 144, 118, 152, 137, 149, 112],
    carbs: [191, 210, 172, 229, 205, 217, 158],
    fat: [54, 61, 50, 68, 59, 63, 48],
  },
  month: {
    calories: [1980, 1840, 2050, 1920, 2180, 1760, 2010, 1850, 2070, 1930, 2140, 1820, 2010, 1890, 2080, 1950, 2200, 1810, 1970, 2050, 1870, 2160, 1900, 2020, 1790, 2100, 1950, 2180, 1880, 1470],
    protein: [140, 126, 146, 134, 152, 118, 144, 129, 148, 137, 150, 124, 143, 131, 149, 137, 154, 122, 139, 146, 128, 151, 133, 142, 120, 148, 136, 152, 130, 112],
    carbs: [206, 191, 215, 199, 229, 172, 210, 194, 220, 202, 226, 185, 209, 196, 217, 205, 232, 178, 201, 214, 190, 225, 198, 208, 176, 219, 204, 229, 193, 158],
    fat: [60, 54, 62, 57, 68, 50, 61, 55, 64, 58, 66, 52, 60, 56, 63, 59, 69, 51, 58, 62, 55, 67, 57, 61, 49, 64, 58, 68, 54, 48],
  },
};

const chartMacros: Array<{ id: AnalyticsMacro; label: string; unit: string; target: number; color: string }> = [
  { id: "calories", label: "Calories", unit: "kcal", target: 2100, color: "bg-coral" },
  { id: "protein", label: "Protein", unit: "g", target: 150, color: "bg-fresh" },
  { id: "carbs", label: "Carbs", unit: "g", target: 220, color: "bg-lime" },
  { id: "fat", label: "Fat", unit: "g", target: 65, color: "bg-primary" },
];

function DashboardPage() {
  return <CustomerAccess><DashboardContent /></CustomerAccess>;
}

function DashboardContent() {
  const [analyticsUnlocked, setAnalyticsUnlocked] = useState(false);
  const [activeMacro, setActiveMacro] = useState<AnalyticsMacro>("calories");
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");

  useEffect(() => {
    setAnalyticsUnlocked(window.localStorage.getItem("fitfuel-premium-preview") === "active");
  }, []);

  const selectedMetric = chartMacros.find((macro) => macro.id === activeMacro) ?? chartMacros[0] ?? { id: "calories" as const, label: "Calories", unit: "kcal", target: 2100, color: "bg-coral" };
  const values = useMemo(() => analyticsData[period][activeMacro], [activeMacro, period]);
  const maxValue = Math.max(selectedMetric.target * 1.12, ...values);

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />
      <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1280px] px-5 pb-16 pt-9 sm:px-8 sm:pt-12 lg:px-12 lg:pt-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Back to the menu</Link>
        <div className="mt-9 flex flex-col justify-between gap-6 border-b border-border pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral">Your daily check-in</p>
            <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Keep your <span className="text-fresh">fuel</span> in view.</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">A snapshot of how today’s nutrition stacks up against your targets.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start border border-border bg-card px-3.5 py-2.5 text-sm font-semibold sm:self-auto"><CalendarDays className="size-4 text-coral" /> Today’s snapshot <span className="text-muted-foreground">·</span> Sample data</div>
        </div>

        <Tabs defaultValue="daily" className="mt-8">
          <TabsList className="h-11 w-full justify-start rounded-none border-b border-border bg-transparent p-0 sm:w-auto">
            <TabsTrigger value="daily" className="h-11 rounded-none px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Daily snapshot</TabsTrigger>
            <TabsTrigger value="advanced" className="h-11 gap-2 rounded-none px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">{!analyticsUnlocked && <LockKeyhole className="size-3.5" />} Advanced analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="mt-0">
        <section aria-label="Today's macro progress" className="mt-8">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="font-display text-2xl font-bold">The big four</h2><p className="mt-1 text-sm text-muted-foreground">Consumed compared with your daily target.</p></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2.5 rounded-full bg-fresh" /> Consumed <span className="ml-2 size-2.5 rounded-full border border-foreground/40" /> Target</div>
          </div>
          <div className="grid border-y border-border sm:grid-cols-2 lg:grid-cols-4">
            {macros.map(({ label, unit, consumed, target, percent, color, marker, Icon }, index) => (
              <article key={label} className={`py-7 sm:px-6 lg:py-8 ${index % 2 === 1 ? "sm:border-l" : ""} ${index >= 2 ? "sm:border-t lg:border-t-0" : ""} ${index > 0 ? "lg:border-l" : ""} border-border`}>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" /> {label}</span><span className={`size-2.5 rounded-full ${marker}`} /></div>
                <div className="mt-6 flex items-baseline gap-2"><span className="font-display text-4xl font-bold tabular-nums">{consumed.toLocaleString()}</span><span className="text-sm text-muted-foreground">/ {target.toLocaleString()} {unit}</span></div>
                <div className="mt-5 h-2 w-full overflow-hidden bg-secondary" role="progressbar" aria-label={`${label} consumed`} aria-valuenow={consumed} aria-valuemin={0} aria-valuemax={target}>
                  <div className={`h-full ${color} transition-[width] duration-500`} style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs"><span className="font-semibold">{percent}% of target</span><span className="text-muted-foreground">{(target - consumed).toLocaleString()} {unit} to go</span></div>
              </article>
            ))}
          </div>
        </section>

          </TabsContent>
          <TabsContent value="advanced" className="mt-0">
        <section className="mt-8 border-y border-border py-7 sm:py-9" aria-label="Advanced analytics">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-coral"><Sparkles className="size-4" /> FitFuel Plus</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Advanced analytics</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">A longer view of your daily macro intake against your goals.</p>
            </div>
            {analyticsUnlocked && (
              <div className="flex w-fit border border-border p-1" aria-label="Choose analytics period">
                {(["week", "month"] as const).map((value) => <Button key={value} variant="ghost" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`h-9 rounded-sm px-4 text-xs font-semibold capitalize ${period === value ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}`}>{value}</Button>)}
              </div>
            )}
          </div>

          {analyticsUnlocked ? (
            <div className="mt-6">
              <div className="mb-5 flex flex-wrap gap-2" aria-label="Choose macro">
                {chartMacros.map((macro) => <Button key={macro.id} variant="outline" aria-pressed={activeMacro === macro.id} onClick={() => setActiveMacro(macro.id)} className={`h-9 rounded-sm px-3 text-xs ${activeMacro === macro.id ? "border-primary bg-secondary font-semibold text-foreground" : "text-muted-foreground"}`}>{macro.label}</Button>)}
              </div>
              <div className="border border-border bg-card px-4 py-5 sm:px-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{selectedMetric.label} · {period === "week" ? "last 7 days" : "last 30 days"}</p><p className="mt-1 text-xs text-muted-foreground">Sample history compared with your {selectedMetric.target} {selectedMetric.unit} daily target</p></div><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className={`size-2.5 ${selectedMetric.color}`} /> Intake</span><span className="inline-flex items-center gap-1.5"><span className="h-0 w-5 border-t border-dashed border-foreground/60" /> Goal</span></div></div>
                <div className="relative h-56 border-b border-l border-border px-2 pb-0 pt-3 sm:h-64" role="img" aria-label={`${selectedMetric.label} sample intake over the last ${period === "week" ? "7 days" : "30 days"}, compared with a daily target of ${selectedMetric.target} ${selectedMetric.unit}`}>
                  <div className="absolute inset-x-2 border-t border-dashed border-foreground/50" style={{ bottom: `${(selectedMetric.target / maxValue) * 100}%` }} />
                  <div className="relative flex h-full items-end justify-around gap-1 sm:gap-2">
                    {values.map((value, index) => <div key={`${period}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${value} ${selectedMetric.unit}`}><span className="sr-only">{period === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] : `Day ${index + 1}`}: {value} {selectedMetric.unit}</span><div className={`w-full ${selectedMetric.color} opacity-85 transition-[height] duration-300`} style={{ height: `${Math.max((value / maxValue) * 100, 3)}%` }} /></div>)}
                  </div>
                </div>
                <div className="mt-2 flex justify-between pl-3 text-[10px] text-muted-foreground">{period === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>) : <><span>Day 1</span><span>Day 10</span><span>Day 20</span><span>Day 30</span></>}</div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Subscriber preview · historical values are sample data, not logged meals.</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-4 border border-border bg-card px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center bg-secondary text-muted-foreground"><LockKeyhole className="size-5" /></span><div><h3 className="font-display text-lg font-bold">Unlock your nutrition history</h3><p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">Premium members can compare daily calories, protein, carbs, and fat against their goals over a week or month.</p></div></div>
              <Button asChild className="shrink-0 rounded-sm"><Link to="/">Explore FitFuel Plus <ArrowUpRight className="size-4" /></Link></Button>
            </div>
          )}
        </section>
          </TabsContent>
        </Tabs>

        <section className="mt-8 grid gap-0 border-y border-border lg:grid-cols-[1.1fr_0.9fr]">
          <div className="py-7 lg:pr-10 lg:py-9">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-coral"><Flame className="size-4" /> Today so far</div>
            <h2 className="mt-3 font-display text-2xl font-bold">A good start to the day.</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">You’re on your way with a balanced mix of protein, carbs, and healthy fats. Make your next meal count.</p>
            <div className="mt-6 grid grid-cols-2 gap-5 border-t border-border pt-5 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Meals logged</p><p className="mt-1 flex items-center gap-2 font-display text-xl font-bold">3 <span className="text-xs font-medium text-muted-foreground">of 4</span></p></div>
              <div><p className="text-xs text-muted-foreground">Calories to goal</p><p className="mt-1 font-display text-xl font-bold">630 <span className="text-xs font-medium">kcal</span></p></div>
              <div className="col-span-2 sm:col-span-1"><p className="text-xs text-muted-foreground">Day’s pace</p><p className="mt-1 flex items-center gap-2 font-display text-xl font-bold"><Check className="size-4 text-fresh" /> Looking good</p></div>
            </div>
          </div>
          <div className="flex flex-col justify-center border-t border-border py-7 lg:border-l lg:border-t-0 lg:pl-10 lg:py-9">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-fresh"><CircleHelp className="size-4" /> Your goal</div>
            <h2 className="mt-3 font-display text-2xl font-bold">Steady and strong.</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Your daily targets help you build consistent habits. Adjust them any time to match your training plan.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild className="h-10 rounded-sm"><Link to="/">Find your next meal <ArrowUpRight className="size-4" /></Link></Button>
            </div>
          </div>
        </section>

        <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ArrowDownRight className="mt-0.5 size-4 shrink-0" /><p>Sample progress for preview. Personalized targets and consumed macros will reflect meals you actually log or order once meal tracking is connected.</p></div>
      </main>
    </div>
  );
}
