import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { catalogApi, type Product } from "@/lib/catalog-api";
import {
  catalogKey,
  useCatalogFilters,
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

const stockChoices = [
  { value: "all", label: "All stock levels" },
  { value: "in-stock", label: "In stock" },
];

function ProductEditor({
  product,
  onClose,
}: {
  product: Product | undefined;
  onClose: () => void;
}) {
  return (
    <CatalogForm
      title={product ? "Edit product" : "Add product"}
      description={product ? product.name : "Set the product’s price and initial stock."}
      active={product?.is_available === true}
      submitLabel={product ? "Save changes" : "Add product"}
      success={product ? "Product updated." : "Product added."}
      onClose={onClose}
      save={(form) => {
        const available = form.has("is_available");
        const fields = {
          name: textField(form, "name").trim(),
          description: optionalText(form, "description"),
          category: optionalText(form, "category"),
          image_url: optionalText(form, "image_url"),
          unit: optionalText(form, "unit"),
          price: Number(textField(form, "price")),
        };
        return product
          ? catalogApi.updateProduct(product.id, {
              ...fields,
              ...availabilityPatch(product.is_available, available),
            })
          : catalogApi.createProduct({
              ...fields,
              is_available: available,
              stock_quantity: Number(textField(form, "stock_quantity")),
            });
      }}
    >
      {() => (
        <>
          <CatalogInput
            label="Product name"
            name="name"
            required
            maxLength={200}
            pattern={".*\\S.*"}
            defaultValue={product?.name}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label="Category"
              name="category"
              maxLength={100}
              defaultValue={product?.category ?? ""}
            />
            <CatalogInput
              label="Unit"
              name="unit"
              maxLength={50}
              defaultValue={product?.unit ?? ""}
            />
          </div>
          <DescriptionField value={product?.description} />
          <CatalogInput
            label="Image URL"
            name="image_url"
            inputMode="url"
            defaultValue={product?.image_url ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label="Price (VND)"
              name="price"
              type="number"
              min={0}
              max={9999999999.99}
              step={0.01}
              required
              defaultValue={product?.price}
            />
            {!product && (
              <CatalogInput
                label="Initial stock"
                name="stock_quantity"
                type="number"
                min={0}
                max={2147483647}
                step={1}
                required
                defaultValue={0}
              />
            )}
          </div>
          <AvailableField available={product ? product.is_available : true} />
        </>
      )}
    </CatalogForm>
  );
}

function StockEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <CatalogForm
      title="Adjust stock"
      description={`${product.name} · Current stock ${product.stock_quantity} ${product.unit ?? ""}`.trim()}
      submitLabel="Apply adjustment"
      success="Stock adjusted."
      onClose={onClose}
      save={(form) => {
        const adjustment = Number(textField(form, "adjustment"));
        if (adjustment === 0) return Promise.reject(new Error("Enter a non-zero quantity."));
        return catalogApi.adjustStock(product.id, adjustment);
      }}
    >
      {() => (
        <div className="space-y-2">
          <CatalogInput
            label="Quantity change"
            name="adjustment"
            type="number"
            min={-1000000}
            max={1000000}
            step={1}
            required
            aria-describedby="catalog-adjustment-help"
          />
          <p id="catalog-adjustment-help" className="text-sm text-muted-foreground">
            Use a positive number to add stock and a negative number to remove it.
          </p>
        </div>
      )}
    </CatalogForm>
  );
}

export function ProductCatalog() {
  const state = useCatalogFilters();
  const [category, setCategory] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [inStock, setInStock] = useState(false);
  const [editor, setEditor] = useState<{ product?: Product } | null>(null);
  const [stockEditor, setStockEditor] = useState<Product | null>(null);
  const [action, setAction] = useState<CatalogAction | null>(null);
  const filters = {
    ...state.filters,
    category: categoryFilter || undefined,
    in_stock: inStock || undefined,
  };
  const products = useQuery({
    queryKey: [...catalogKey, "products", filters],
    queryFn: ({ signal }) => catalogApi.listProducts(filters, signal),
    retry: false,
  });

  return (
    <section
      aria-labelledby="catalog-products"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="space-y-4 p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="catalog-products" className="text-base font-semibold">
            Product inventory
          </h2>
          <Button data-catalog-add className="min-h-11" onClick={() => setEditor({})}>
            Add product
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CatalogInput
            label="Search products"
            type="search"
            value={state.input}
            maxLength={200}
            onChange={(event) => state.setInput(event.target.value)}
          />
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setCategoryFilter(category);
              state.setPage(1);
            }}
          >
            <div className="min-w-0 flex-1">
              <CatalogInput
                label="Category"
                type="search"
                placeholder="Exact category name"
                value={category}
                maxLength={100}
                onChange={(event) => {
                  const value = event.target.value;
                  setCategory(value);
                  if (!value && categoryFilter) {
                    setCategoryFilter("");
                    state.setPage(1);
                  }
                }}
              />
            </div>
            <Button type="submit" variant="outline" className="min-h-11">
              Apply
            </Button>
          </form>
          <CatalogSelect
            label="Stock"
            value={inStock ? "in-stock" : "all"}
            options={stockChoices}
            onValueChange={(value) => {
              setInStock(value === "in-stock");
              state.setPage(1);
            }}
          />
          <AvailabilityFilter state={state} />
        </div>
      </div>
      <CatalogResults
        query={products}
        empty={products.data?.data.length === 0 ? "No matching products." : undefined}
      >
        <CatalogTable
          name="Product inventory"
          columns={["Product", "Category", "Price", "In stock", "Unit", "Status", "Actions"]}
        >
          {products.data?.data.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="min-w-36 max-w-64 font-medium [overflow-wrap:anywhere]">
                {product.name}
              </TableCell>
              <TableCell className="min-w-28 max-w-44 [overflow-wrap:anywhere]">
                {product.category || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {vnd.format(product.price)}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {product.stock_quantity}
              </TableCell>
              <TableCell className="max-w-32 [overflow-wrap:anywhere]">
                {product.unit || "—"}
              </TableCell>
              <TableCell>
                <AvailabilityBadge available={product.is_available} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1 whitespace-nowrap">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => setEditor({ product })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Adjust stock for ${product.name}`}
                    onClick={() => setStockEditor(product)}
                  >
                    Adjust stock
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`${product.is_available ? "Pause" : "Resume"} ${product.name}`}
                    onClick={() =>
                      setAction(
                        salesAction(product.name, product.is_available === true, () =>
                          product.is_available
                            ? catalogApi.archiveProduct(product.id)
                            : catalogApi.updateProduct(product.id, { is_available: true }),
                        ),
                      )
                    }
                  >
                    {product.is_available ? "Pause" : "Resume"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </CatalogTable>
      </CatalogResults>
      {products.data && !products.isError && (
        <CatalogPagination
          pagination={products.data.pagination}
          state={state}
          pending={products.isFetching}
        />
      )}
      {editor && <ProductEditor product={editor.product} onClose={() => setEditor(null)} />}
      {stockEditor && <StockEditor product={stockEditor} onClose={() => setStockEditor(null)} />}
      {action && <CatalogConfirm action={action} onClose={() => setAction(null)} />}
    </section>
  );
}
