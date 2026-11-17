import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, customersSchema, type Customer } from "@/lib/admin-api";
import { CustomerDetails } from "./customer-details";
import { CustomerStatusDialog } from "./customer-status-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountStatus, PageControls } from "./customer-ui";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CustomerDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [action, setAction] = useState<Customer | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const list = useQuery({
    queryKey: ["admin", "customers", search, status, page],
    queryFn: ({ signal }) =>
      api(
        `/admin/customers?${new URLSearchParams({ search, status, page: String(page) })}`,
        customersSchema,
        { signal },
      ),
    retry: false,
  });
  useEffect(() => {
    if (list.data && page > 1 && !list.data.data.length)
      setPage(Math.max(1, Math.ceil(list.data.pagination.total / 20)));
  }, [list.data, page]);

  function actions(customer: Customer) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => setSelected(customer)}
          aria-label={`View ${customer.full_name}`}
        >
          View
        </Button>
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => setAction(customer)}
          aria-label={`${customer.is_locked ? "Unlock" : "Lock"} ${customer.full_name}`}
        >
          {customer.is_locked ? "Unlock" : "Lock"}
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="customer-directory-title" className="space-y-4 text-foreground">
      {notice && (
        <Alert variant="success" role="status">
          <AlertDescription className="[overflow-wrap:anywhere]">{notice}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-lg border border-border bg-card text-card-foreground">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-4 sm:p-5">
          <h2 id="customer-directory-title" className="text-base font-semibold">
            Customer directory
          </h2>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <div className="space-y-2 sm:w-64">
              <Label htmlFor="customer-search">Search customers</Label>
              <Input
                id="customer-search"
                type="search"
                value={query}
                maxLength={200}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email or phone"
                className="h-11"
              />
            </div>
            <div className="space-y-2 sm:w-44">
              <Label htmlFor="customer-status">Account status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="customer-status" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {list.isPending ? (
          <p role="status" className="p-5">
            Loading customers…
          </p>
        ) : list.isError ? (
          <div className="space-y-3 p-5">
            <Alert variant="destructive">
              <AlertDescription>Could not load customers. {list.error.message}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => void list.refetch()}>
              Try again
            </Button>
          </div>
        ) : list.data.data.length === 0 ? (
          <div className="space-y-2 p-8 text-center">
            <p>No matching customers.</p>
            <p className="text-sm text-muted-foreground">Try another search or account status.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableCaption className="sr-only">
                  Customer contact details, fitness goals and account status
                </TableCaption>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    {["Customer", "Contact", "Fitness goal", "Status", "Actions"].map((heading) => (
                      <TableHead key={heading} scope="col" className="px-5">
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="max-w-60 [overflow-wrap:anywhere] px-5 font-medium">
                        {customer.full_name}
                      </TableCell>
                      <TableCell className="max-w-72 [overflow-wrap:anywhere] px-5">
                        <p>{customer.email}</p>
                        <p className="mt-1 text-muted-foreground">{customer.phone || "No phone"}</p>
                      </TableCell>
                      <TableCell className="px-5">
                        {customer.fitness_goal || "Not specified"}
                      </TableCell>
                      <TableCell className="px-5">
                        <AccountStatus locked={customer.is_locked} />
                      </TableCell>
                      <TableCell className="px-5">{actions(customer)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul aria-label="Customers" className="divide-y divide-border md:hidden">
              {list.data.data.map((customer) => (
                <li key={customer.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 max-w-full text-base font-semibold [overflow-wrap:anywhere]">
                      {customer.full_name}
                    </p>
                    <AccountStatus locked={customer.is_locked} />
                  </div>
                  <dl className="space-y-2 text-sm">
                    {[
                      ["Fitness goal", customer.fitness_goal || "Not specified"],
                      ["Email", customer.email],
                      ["Phone", customer.phone || "No phone"],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="[overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {actions(customer)}
                </li>
              ))}
            </ul>
          </>
        )}
        {list.data && !list.isError && (
          <div className="px-4 sm:px-5">
            <PageControls
              page={page}
              total={list.data.pagination.total}
              size={20}
              onChange={setPage}
              pending={list.isFetching}
            />
          </div>
        )}
      </div>
      {selected && <CustomerDetails customer={selected} onClose={() => setSelected(null)} />}
      {action && (
        <CustomerStatusDialog
          customer={action}
          onClose={() => setAction(null)}
          onSuccess={(message) => {
            setAction(null);
            setNotice(message);
          }}
        />
      )}
    </section>
  );
}
