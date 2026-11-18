import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { CategoryCatalog } from "./category-catalog";
import { MealCatalog } from "./meal-catalog";
import { ProductCatalog } from "./product-catalog";

export function CatalogManager() {
  return (
    <Tabs defaultValue="meals" className="min-w-0">
      <TabsList
        aria-label="Catalog sections"
        className="grid h-auto w-full grid-cols-3 sm:inline-grid sm:w-auto"
      >
        <TabsTrigger value="meals" className="min-h-11 px-4">
          Meals
        </TabsTrigger>
        <TabsTrigger value="categories" className="min-h-11 px-4">
          Categories
        </TabsTrigger>
        <TabsTrigger value="products" className="min-h-11 px-4">
          Products
        </TabsTrigger>
      </TabsList>
      <TabsContent value="meals" className="mt-4">
        <MealCatalog />
      </TabsContent>
      <TabsContent value="categories" className="mt-4">
        <CategoryCatalog />
      </TabsContent>
      <TabsContent value="products" className="mt-4">
        <ProductCatalog />
      </TabsContent>
      <Toaster position="bottom-center" visibleToasts={1} />
    </Tabs>
  );
}
