import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { catalogApi, type Meal, type MealOption } from "@/lib/catalog-api";
import {
  catalogKey,
  vnd,
  availabilityPatch,
  optionalText,
  salesAction,
  textField,
  type CatalogAction,
} from "./catalog-data";
import {
  AvailableField,
  CatalogConfirm,
  CatalogDialog,
  CatalogForm,
  DescriptionField,
} from "./catalog-dialogs";
import { AvailabilityBadge, CatalogInput, CatalogResults } from "./catalog-ui";

export function MealOptions({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const options = useQuery({
    queryKey: [...catalogKey, "meal-options", meal.id],
    queryFn: ({ signal }) => catalogApi.listOptions(meal.id, signal),
    retry: false,
  });
  const [editor, setEditor] = useState<{ option?: MealOption } | null>(null);
  const [action, setAction] = useState<CatalogAction | null>(null);
  const editing = editor?.option;

  return (
    <CatalogDialog title="Customization options" description={meal.name} onClose={onClose}>
      <div className="flex justify-end">
        <Button data-catalog-add className="min-h-11" onClick={() => setEditor({})}>
          Add option
        </Button>
      </div>
      <CatalogResults
        query={options}
        empty={options.data?.data.length === 0 ? "No customization options yet." : undefined}
      >
        <ul
          aria-label="Meal customization options"
          className="divide-y divide-border border-y border-border"
        >
          {options.data?.data.map((option) => (
            <li className="flex flex-wrap items-start justify-between gap-3 py-3" key={option.id}>
              <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                <p className="font-medium">{option.name}</p>
                {option.description && (
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums">
                    {option.price_adjustment > 0 ? "+" : ""}
                    {vnd.format(option.price_adjustment)}
                  </span>
                  <AvailabilityBadge available={option.is_available} />
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Edit ${option.name}`}
                  onClick={() => setEditor({ option })}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11"
                  aria-label={`${option.is_available ? "Pause" : "Resume"} ${option.name}`}
                  onClick={() =>
                    setAction(
                      salesAction(option.name, option.is_available === true, () =>
                        option.is_available
                          ? catalogApi.archiveOption(meal.id, option.id)
                          : catalogApi.updateOption(meal.id, option.id, { is_available: true }),
                      ),
                    )
                  }
                >
                  {option.is_available ? "Pause" : "Resume"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CatalogResults>
      {editor && (
        <CatalogForm
          title={editing ? "Edit option" : "Add option"}
          description={editing?.name ?? meal.name}
          nameConflict="OPTION_NAME_TAKEN"
          active={editing?.is_available === true}
          submitLabel={editing ? "Save changes" : "Add option"}
          success={editing ? "Option updated." : "Option added."}
          onClose={() => setEditor(null)}
          save={(form) => {
            const available = form.has("is_available");
            const fields = {
              name: textField(form, "name").trim(),
              description: optionalText(form, "description"),
              price_adjustment: Number(textField(form, "price_adjustment")),
            };
            return editing
              ? catalogApi.updateOption(meal.id, editing.id, {
                  ...fields,
                  ...availabilityPatch(editing.is_available, available),
                })
              : catalogApi.createOption(meal.id, { ...fields, is_available: available });
          }}
        >
          {(error, clearError) => (
            <>
              <CatalogInput
                label="Option name"
                name="name"
                required
                maxLength={150}
                pattern={".*\\S.*"}
                defaultValue={editing?.name}
                error={error}
                onChange={clearError}
              />
              <DescriptionField value={editing?.description} />
              <CatalogInput
                label="Price adjustment (VND)"
                name="price_adjustment"
                type="number"
                min={-100000000}
                max={100000000}
                step={0.01}
                required
                defaultValue={editing?.price_adjustment ?? 0}
              />
              <AvailableField available={editing ? editing.is_available : true} />
            </>
          )}
        </CatalogForm>
      )}
      {action && <CatalogConfirm action={action} onClose={() => setAction(null)} />}
    </CatalogDialog>
  );
}
