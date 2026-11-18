import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { catalogApi, type Category } from "@/lib/catalog-api";
import { useCategories, optionalText, textField } from "./catalog-data";
import { CatalogConfirm, CatalogForm, DescriptionField } from "./catalog-dialogs";
import { CatalogInput, CatalogResults, CatalogTable } from "./catalog-ui";

export function CategoryCatalog() {
  const categories = useCategories();
  const [editor, setEditor] = useState<{ category?: Category } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const category = editor?.category;

  return (
    <section
      aria-labelledby="catalog-categories"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
        <h2 id="catalog-categories" className="text-base font-semibold">
          Meal categories
        </h2>
        <Button data-catalog-add className="min-h-11" onClick={() => setEditor({})}>
          Add category
        </Button>
      </div>
      <CatalogResults
        query={categories}
        empty={categories.data?.data.length === 0 ? "No categories yet." : undefined}
      >
        <CatalogTable
          name="Meal categories"
          columns={["Name", "Description", "Meals on sale", "Actions"]}
        >
          {categories.data?.data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="min-w-32 max-w-60 font-medium [overflow-wrap:anywhere]">
                {item.name}
              </TableCell>
              <TableCell className="min-w-40 max-w-96 [overflow-wrap:anywhere]">
                {item.description || "—"}
              </TableCell>
              <TableCell className="tabular-nums">{item.meal_count}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setEditor({ category: item })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDeleting(item)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </CatalogTable>
      </CatalogResults>
      {editor && (
        <CatalogForm
          title={category ? "Edit category" : "Add category"}
          description={category ? category.name : "Create a category for meals."}
          nameConflict="CATEGORY_NAME_TAKEN"
          submitLabel={category ? "Save changes" : "Add category"}
          save={(form) => {
            const fields = {
              name: textField(form, "name").trim(),
              description: optionalText(form, "description"),
            };
            return category
              ? catalogApi.updateCategory(category.id, fields)
              : catalogApi.createCategory(fields);
          }}
          success={category ? "Category updated." : "Category added."}
          onClose={() => setEditor(null)}
        >
          {(error, clearError) => (
            <>
              <CatalogInput
                label="Category name"
                name="name"
                required
                maxLength={100}
                pattern={".*\\S.*"}
                defaultValue={category?.name}
                error={error}
                onChange={clearError}
              />
              <DescriptionField value={category?.description} />
            </>
          )}
        </CatalogForm>
      )}
      {deleting && (
        <CatalogConfirm
          action={{
            title: "Delete category",
            description: `Permanently delete “${deleting.name}”?`,
            destructive: true,
            run: () => catalogApi.deleteCategory(deleting.id),
            success: "Category deleted.",
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
