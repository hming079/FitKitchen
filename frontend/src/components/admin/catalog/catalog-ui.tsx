import { useEffect, useId, type ComponentProps, type ReactNode } from "react";
import { PageControls, SectionError } from "@/components/admin/customer-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { useCatalogFilters } from "./catalog-data";

type Choice = { value: string; label: string };

export function CatalogSelect({
  label,
  options,
  ...props
}: ComponentProps<typeof Select> & { label: string; options: readonly Choice[] }) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select {...props}>
        <SelectTrigger
          id={id}
          className="h-11 w-full gap-2 text-base sm:text-sm [&>span]:block [&>span]:truncate [&>svg]:shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="motion-reduce:animate-none">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="min-h-11 [overflow-wrap:anywhere]"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const availabilityChoices = [
  { value: "all", label: "All statuses" },
  { value: "true", label: "On sale" },
  { value: "false", label: "Paused" },
];

export function AvailabilityFilter({ state }: { state: ReturnType<typeof useCatalogFilters> }) {
  return (
    <CatalogSelect
      label="Sales status"
      value={state.filters.available}
      onValueChange={state.setAvailable}
      options={availabilityChoices}
    />
  );
}

export function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === null)
    return (
      <Badge variant="secondary" className="whitespace-nowrap">
        Not set
      </Badge>
    );
  return (
    <Badge variant={available ? "success" : "secondary"} className="whitespace-nowrap">
      {available ? "On sale" : "Paused"}
    </Badge>
  );
}

export function CatalogInput({
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-11"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CatalogResults({
  query,
  empty,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<unknown>;
  };
  empty: string | undefined;
  children: ReactNode;
}) {
  if (query.isPending)
    return (
      <div role="status" className="space-y-3 p-4 sm:px-5">
        <span className="sr-only">Loading catalog data</span>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-9 motion-reduce:animate-none" />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <div className="p-4 sm:px-5">
        <SectionError
          message={query.error?.message ?? "Could not load catalog data."}
          retry={() => void query.refetch()}
        />
      </div>
    );
  if (empty)
    return (
      <p className="p-5 text-sm text-muted-foreground" role="status">
        {empty}
      </p>
    );
  return children;
}

export function CatalogTable({
  name,
  columns,
  children,
}: {
  name: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <>
      <p className="px-4 pb-2 text-sm text-muted-foreground md:hidden">
        Scroll across to see all columns and actions.
      </p>
      <div
        role="region"
        aria-label={`${name} table`}
        tabIndex={0}
        className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&>div]:overflow-visible"
      >
        <Table>
          <TableCaption className="sr-only">{name}</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((column) => (
                <TableHead key={column} scope="col" className="whitespace-nowrap px-4">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:px-4">{children}</TableBody>
        </Table>
      </div>
    </>
  );
}

export function CatalogPagination({
  pagination,
  state,
  pending,
}: {
  pagination: { page: number; page_size: number; total: number; total_pages: number };
  state: ReturnType<typeof useCatalogFilters>;
  pending: boolean;
}) {
  const { page, page_size, total, total_pages } = pagination;
  const { setPage } = state;
  const last = Math.max(1, total_pages);
  useEffect(() => {
    if (page > last) setPage(last);
  }, [page, last, setPage]);
  return (
    <div className="border-t border-border px-4 sm:px-5">
      <PageControls
        page={Math.min(page, last)}
        total={total}
        size={page_size}
        onChange={setPage}
        pending={pending || state.searchPending || page > last}
      />
    </div>
  );
}
