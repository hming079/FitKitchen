import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { SectionError } from "@/components/admin/customer-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  catalogApi,
  goalTypes,
  mealTypes,
  type Category,
  type GoalType,
  type Meal,
  type MealType,
} from "@/lib/catalog-api";
import {
  catalogKey,
  useCatalogFilters,
  useCategories,
  vnd,
  availabilityPatch,
  optionalText,
  salesAction,
  textField,
  type CatalogAction,
} from "./catalog-data";
import { AvailableField, CatalogConfirm, CatalogForm, DescriptionField } from "./catalog-dialogs";
import {
  AvailabilityBadge,
  AvailabilityFilter,
  CatalogInput,
  CatalogPagination,
  CatalogResults,
  CatalogSelect,
  CatalogTable,
} from "./catalog-ui";
import { MealOptions } from "./meal-options";

const typeLabels: Record<MealType, string> = {
  SINGLE: "Single",
  COMBO_7_DAYS: "7-day combo",
  TOPPING: "Topping",
};
const typeChoices = mealTypes.map((value) => ({ value, label: typeLabels[value] }));
const goalLabels: Record<GoalType, string> = { BULK: "Bulk", CUT: "Cut", MAINTAIN: "Maintain" };
const goalChoices = goalTypes.map((value) => ({ value, label: goalLabels[value] }));
const noCategory = { value: "none", label: "No category" };
const allCategories = { value: "all", label: "All categories" };
const mealMeasures = [
  { name: "calories", label: "Calories (kcal)" },
  { name: "protein_g", label: "Protein (g)" },
  { name: "carbs_g", label: "Carbs (g)" },
  { name: "fat_g", label: "Fat (g)" },
] as const;

function categoryChoice(category: Category) {
  return { value: category.id, label: category.name };
}

function MealThumbnail({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  let src: string | undefined;
  if (url?.startsWith("/") && !/^[/][\\/]/.test(url)) src = url;
  else if (url && /^https?:\/\//i.test(url)) src = url;
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <ImageOff size={16} aria-hidden />
      )}
    </span>
  );
}

function MealEditor({
  meal,
  categories,
  onClose,
}: {
  meal: Meal | undefined;
  categories: Category[];
  onClose: () => void;
}) {
  const allergensId = useId();
  const choices = [noCategory, ...categories.map(categoryChoice)];
  if (meal?.category_id && !categories.some((category) => category.id === meal.category_id)) {
    choices.push({ value: meal.category_id, label: "Unknown category" });
  }
  return (
    <CatalogForm
      title={meal ? "Edit meal" : "Add meal"}
      description={meal ? meal.name : "Set the meal’s price, nutrition and sales status."}
      active={meal?.is_available === true}
      submitLabel={meal ? "Save changes" : "Add meal"}
      success={meal ? "Meal updated." : "Meal added."}
      onClose={onClose}
      save={(form) => {
        const categoryId = textField(form, "category_id");
        const type = mealTypes.find((value) => value === textField(form, "meal_type"));
        const goal = textField(form, "goal_type");
        const available = form.has("is_available");
        const fields = {
          name: textField(form, "name").trim(),
          category_id: categoryId !== "none" && categoryId !== "" ? categoryId : null,
          description: optionalText(form, "description"),
          image_url: optionalText(form, "image_url"),
          price: Number(textField(form, "price")),
          calories: Number(textField(form, "calories")),
          protein_g: Number(textField(form, "protein_g")),
          carbs_g: Number(textField(form, "carbs_g")),
          fat_g: Number(textField(form, "fat_g")),
          meal_type: type,
          goal_type: goalTypes.find((value) => value === goal) ?? null,
          allergen_info: optionalText(form, "allergen_info"),
        };
        return meal
          ? catalogApi.updateMeal(meal.id, {
              ...fields,
              ...availabilityPatch(meal.is_available, available),
            })
          : catalogApi.createMeal({ ...fields, is_available: available });
      }}
    >
      {() => (
        <>
          <CatalogInput
            label="Meal name"
            name="name"
            required
            maxLength={200}
            pattern={".*\\S.*"}
            defaultValue={meal?.name}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogSelect
              label="Category"
              name="category_id"
              options={choices}
              defaultValue={meal?.category_id ?? "none"}
            />
            <CatalogSelect
              label="Meal type"
              name="meal_type"
              options={
                meal?.meal_type === null
                  ? [{ value: "none", label: "Not set" }, ...typeChoices]
                  : typeChoices
              }
              defaultValue={meal ? (meal.meal_type ?? "none") : "SINGLE"}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogSelect
              label="Goal"
              name="goal_type"
              options={[{ value: "none", label: "None" }, ...goalChoices]}
              defaultValue={meal?.goal_type ?? "none"}
            />
            <div className="min-w-0 space-y-2">
              <Label htmlFor={allergensId}>Allergens</Label>
              <Textarea
                id={allergensId}
                name="allergen_info"
                rows={2}
                className="resize-y"
                maxLength={500}
                defaultValue={meal?.allergen_info ?? ""}
              />
            </div>
          </div>
          <DescriptionField value={meal?.description} />
          <CatalogInput
            label="Image URL"
            name="image_url"
            inputMode="url"
            defaultValue={meal?.image_url ?? ""}
          />
          <CatalogInput
            label="Price (VND)"
            name="price"
            type="number"
            min={0}
            max={9999999999.99}
            step={0.01}
            required
            defaultValue={meal?.price}
          />
          <div className="grid grid-cols-2 gap-4">
            {mealMeasures.map(({ name, label }) => (
              <CatalogInput
                key={name}
                label={label}
                name={name}
                type="number"
                min={0}
                max={999999.99}
                step={0.01}
                required
                defaultValue={meal?.[name]}
              />
            ))}
          </div>
          <AvailableField available={meal ? meal.is_available : true} />
        </>
      )}
    </CatalogForm>
  );
}

export function MealCatalog() {
  const state = useCatalogFilters();
  const categories = useCategories();
  const [category, setCategory] = useState("all");
  const [goal, setGoal] = useState("all");
  const [editor, setEditor] = useState<{ meal?: Meal } | null>(null);
  const [options, setOptions] = useState<Meal | null>(null);
  const [action, setAction] = useState<CatalogAction | null>(null);
  const filters = {
    ...state.filters,
    category_id: category === "all" ? undefined : category,
    goal_type: goalTypes.find((value) => value === goal),
  };
  const meals = useQuery({
    queryKey: [...catalogKey, "meals", filters],
    queryFn: ({ signal }) => catalogApi.listMeals(filters, signal),
    retry: false,
  });
  const categoryItems = categories.data?.data ?? [];
  const categoryNames = new Map(categoryItems.map((item) => [item.id, item.name]));

  return (
    <section
      aria-labelledby="catalog-meals"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="space-y-4 p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="catalog-meals" className="text-base font-semibold">
            Meal listings
          </h2>
          <Button
            data-catalog-add
            className="min-h-11"
            disabled={!categories.isSuccess}
            onClick={() => setEditor({})}
          >
            Add meal
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <CatalogInput
            label="Search meals"
            type="search"
            value={state.input}
            maxLength={200}
            onChange={(event) => state.setInput(event.target.value)}
          />
          <CatalogSelect
            label="Category"
            value={category}
            disabled={!categories.isSuccess}
            options={[allCategories, ...categoryItems.map(categoryChoice)]}
            onValueChange={(value) => {
              setCategory(value);
              state.setPage(1);
            }}
          />
          <CatalogSelect
            label="Goal"
            value={goal}
            options={[{ value: "all", label: "All goals" }, ...goalChoices]}
            onValueChange={(value) => {
              setGoal(value);
              state.setPage(1);
            }}
          />
          <AvailabilityFilter state={state} />
        </div>
        {categories.isError && (
          <SectionError
            message={`Could not load meal categories. ${categories.error.message}`}
            retry={() => void categories.refetch()}
          />
        )}
      </div>
      <CatalogResults
        query={meals}
        empty={meals.data?.data.length === 0 ? "No matching meals." : undefined}
      >
        <CatalogTable
          name="Meal listings"
          columns={[
            "Meal",
            "Goal",
            "Category",
            "Price",
            "Type",
            "Calories",
            "Protein",
            "Status",
            "Actions",
          ]}
        >
          {meals.data?.data.map((meal) => (
            <TableRow key={meal.id}>
              <TableCell className="min-w-48 max-w-64 font-medium">
                <div className="flex items-center gap-3">
                  <MealThumbnail key={meal.image_url} url={meal.image_url} />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{meal.name}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {meal.goal_type ? goalLabels[meal.goal_type] : "—"}
              </TableCell>
              <TableCell className="min-w-28 max-w-44 [overflow-wrap:anywhere]">
                {meal.category_id ? (categoryNames.get(meal.category_id) ?? "—") : "No category"}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {vnd.format(meal.price)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {meal.meal_type ? typeLabels[meal.meal_type] : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{meal.calories} kcal</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{meal.protein_g} g</TableCell>
              <TableCell>
                <AvailabilityBadge available={meal.is_available} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1 whitespace-nowrap">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={!categories.isSuccess}
                    aria-label={`Edit ${meal.name}`}
                    onClick={() => setEditor({ meal })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Options for ${meal.name}`}
                    onClick={() => setOptions(meal)}
                  >
                    Options
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`${meal.is_available ? "Pause" : "Resume"} ${meal.name}`}
                    onClick={() =>
                      setAction(
                        salesAction(meal.name, meal.is_available === true, () =>
                          meal.is_available
                            ? catalogApi.archiveMeal(meal.id)
                            : catalogApi.updateMeal(meal.id, { is_available: true }),
                        ),
                      )
                    }
                  >
                    {meal.is_available ? "Pause" : "Resume"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </CatalogTable>
      </CatalogResults>
      {meals.data && !meals.isError && (
        <CatalogPagination
          pagination={meals.data.pagination}
          state={state}
          pending={meals.isFetching}
        />
      )}
      {editor && (
        <MealEditor meal={editor.meal} categories={categoryItems} onClose={() => setEditor(null)} />
      )}
      {options && <MealOptions meal={options} onClose={() => setOptions(null)} />}
      {action && <CatalogConfirm action={action} onClose={() => setAction(null)} />}
    </section>
  );
}
