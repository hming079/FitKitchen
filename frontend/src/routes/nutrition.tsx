import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CustomerAccess } from "@/components/customer-access";
import { MenuMealCard } from "@/components/menu-meal-card";
import { StoreHeader } from "@/components/store-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/admin-api";
import { nutritionApi, type NutritionProfile } from "@/lib/nutrition-api";

export const Route = createFileRoute("/nutrition")({ ssr: false, component: NutritionPage });

const defaults: NutritionProfile = {
  gender: "FEMALE",
  age: 30,
  height_cm: 165,
  weight_kg: 65,
  activity_level: "MODERATE",
  goal: "MAINTENANCE",
};
const groupLabels: Record<string, string> = {
  SINGLE: "Single meals",
  COMBO_7_DAYS: "7 day combos",
  TOPPING: "Toppings",
  OTHER: "Other meals",
};

function NutritionPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["nutrition-profile"],
    queryFn: ({ signal }) => nutritionApi.getProfile(signal),
    retry: false,
  });
  const [form, setForm] = useState<NutritionProfile>(defaults);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    if (query.data?.data) setForm(query.data.data.profile);
  }, [query.data]);
  const save = useMutation({
    mutationFn: nutritionApi.saveProfile,
    onSuccess: async (result) => {
      await client.setQueryData(["nutrition-profile"], result);
      setFormError("");
    },
    onError: (error) =>
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not save your profile. Please try again.",
      ),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    save.mutate(form);
  }
  function update<K extends keyof NutritionProfile>(key: K, value: NutritionProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const nutrition = query.data?.data;
  const recommendations = nutrition?.recommendations ?? {};
  return (
    <CustomerAccess>
      <div className="min-h-screen bg-background text-foreground">
        <StoreHeader />
        <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to the menu
          </Link>
          <header className="mt-6 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Personalized nutrition
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
              A plan shaped around you.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Share a few details to estimate daily nutrition targets and find meals from our menu
              that fit.
            </p>
          </header>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
            <form
              onSubmit={submit}
              className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6"
            >
              <h2 className="font-display text-xl font-semibold">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Gender" id="gender">
                  <Select
                    value={form.gender}
                    onValueChange={(v) => update("gender", v as NutritionProfile["gender"])}
                  >
                    <SelectTrigger id="gender" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="MALE">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Age (years)" id="age">
                  <Input
                    id="age"
                    required
                    className="min-h-11"
                    type="number"
                    min="18"
                    max="100"
                    step="1"
                    value={form.age}
                    onChange={(e) => update("age", Number(e.target.value))}
                  />
                </Field>
                <Field label="Height (cm)" id="height">
                  <Input
                    id="height"
                    required
                    className="min-h-11"
                    type="number"
                    min="130"
                    max="230"
                    step="0.1"
                    value={form.height_cm}
                    onChange={(e) => update("height_cm", Number(e.target.value))}
                  />
                </Field>
                <Field label="Weight (kg)" id="weight">
                  <Input
                    id="weight"
                    required
                    className="min-h-11"
                    type="number"
                    min="35"
                    max="300"
                    step="0.1"
                    value={form.weight_kg}
                    onChange={(e) => update("weight_kg", Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Activity level" id="activity-level">
                <Select
                  value={form.activity_level}
                  onValueChange={(v) =>
                    update("activity_level", v as NutritionProfile["activity_level"])
                  }
                >
                  <SelectTrigger id="activity-level" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEDENTARY">Mostly sitting</SelectItem>
                    <SelectItem value="LIGHT">Light activity</SelectItem>
                    <SelectItem value="MODERATE">Moderate activity</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="VERY_ACTIVE">Very active</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Your goal" id="goal">
                <Select
                  value={form.goal}
                  onValueChange={(v) => update("goal", v as NutritionProfile["goal"])}
                >
                  <SelectTrigger id="goal" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FAT_LOSS">Fat loss</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintain weight</SelectItem>
                    <SelectItem value="MUSCLE_GAIN">Build muscle</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">
                {save.isPending && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                {nutrition ? "Update my targets" : "Create my plan"}
              </Button>
              {query.isError && (
                <p className="text-sm text-destructive" role="alert">
                  {query.error instanceof ApiError
                    ? query.error.message
                    : "Could not load your nutrition profile."}
                </p>
              )}
            </form>

            <section aria-live="polite" className="space-y-6">
              {query.isPending ? (
                <p role="status" className="py-8 text-muted-foreground">
                  Loading your nutrition profile…
                </p>
              ) : nutrition ? (
                <>
                  <div>
                    <h2 className="font-display text-xl font-semibold">Your daily targets</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Estimated from your profile using the Mifflin–St Jeor equation.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Target
                        label="Calories"
                        value={nutrition.targets.target_calories}
                        unit="kcal"
                      />
                      <Target label="Protein" value={nutrition.targets.macros.protein_g} unit="g" />
                      <Target label="Carbs" value={nutrition.targets.macros.carbs_g} unit="g" />
                      <Target label="Fat" value={nutrition.targets.macros.fat_g} unit="g" />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      BMR {nutrition.targets.bmr.toLocaleString()} kcal · TDEE{" "}
                      {nutrition.targets.tdee.toLocaleString()} kcal
                    </p>
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      Meals that fit your targets
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ranked by closeness to one third of your daily calories and macros. Add any
                      meal to your cart or open it to customize.
                    </p>
                    {Object.keys(recommendations).length === 0 ? (
                      <p className="mt-4 rounded-lg border border-border p-5 text-sm text-muted-foreground">
                        There are no available meals to recommend right now. Check back soon.
                      </p>
                    ) : (
                      Object.entries(recommendations).map(([type, meals]) => (
                        <div key={type} className="mt-6">
                          <h3 className="mb-3 text-base font-semibold">
                            {groupLabels[type] ?? type}
                          </h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {meals.map((meal) => (
                              <MenuMealCard key={meal.id} meal={meal} />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Enter your details and save to see your estimated targets and meal
                  recommendations.
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </CustomerAccess>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function Target({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">
        {value.toLocaleString()}
        <span className="ml-1 text-xs font-sans font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
