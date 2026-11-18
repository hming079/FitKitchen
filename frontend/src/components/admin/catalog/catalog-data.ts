import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { catalogApi } from "@/lib/catalog-api";

export const catalogKey = ["admin", "catalog"] as const;
export const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
type Availability = "all" | "true" | "false";

export function useCategories() {
  return useQuery({
    queryKey: [...catalogKey, "categories"],
    queryFn: ({ signal }) => catalogApi.listCategories(signal),
    retry: false,
  });
}

export function useCatalogFilters() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [available, setAvailable] = useState<Availability>("all");
  useEffect(() => {
    if (input.trim() === search) return;
    const timeout = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [input, search]);

  return {
    input,
    setInput,
    filters: { page, search, available },
    setPage,
    setAvailable(value: string) {
      if (value === "all" || value === "true" || value === "false") {
        setAvailable(value);
        setPage(1);
      }
    },
    searchPending: input.trim() !== search,
  };
}

export type CatalogAction = {
  title: string;
  description: string;
  success: string;
  destructive?: boolean;
  run: () => Promise<unknown>;
};

export function textField(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

export function optionalText(form: FormData, name: string) {
  const value = textField(form, name);
  return value.trim() ? value : null;
}

export function availabilityPatch(previous: boolean | null, available: boolean) {
  return available === (previous === true) ? {} : { is_available: available };
}

export function salesAction(
  name: string,
  active: boolean,
  run: CatalogAction["run"],
): CatalogAction {
  return {
    title: active ? "Pause sales" : "Resume sales",
    description: active ? `Take “${name}” off sale?` : `Make “${name}” available for sale?`,
    success: active ? "Sales paused." : "Sales resumed.",
    destructive: active,
    run,
  };
}
