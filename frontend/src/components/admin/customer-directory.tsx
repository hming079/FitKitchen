import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Customer = { name: string; email: string; phone: string; goal: string };

export function CustomerDirectory({
  rows,
  query,
  onQueryChange,
}: {
  rows: Customer[];
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <section aria-labelledby="customer-directory-title" className="space-y-4 text-foreground">
      <Alert variant="info" role="note">
        <AlertDescription>
          Demo directory. Account actions and customer history are not connected.
        </AlertDescription>
      </Alert>
      <div className="rounded-lg border border-border bg-card text-card-foreground">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <h2 id="customer-directory-title" className="text-base font-semibold">
              Customer directory
            </h2>
            <p role="status" className="mt-1 text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "customer" : "customers"} in this demo
            </p>
          </div>
          <div className="w-full space-y-2 sm:w-72">
            <Label htmlFor="customer-search">Search customers</Label>
            <Input
              id="customer-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Name, email or phone"
              className="h-11"
            />
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">No matching customers.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another name, email or phone number.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableCaption className="sr-only">
                  Demo customer contact details and fitness goals
                </TableCaption>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    {["Customer", "Email address", "Phone", "Fitness goal"].map((heading) => (
                      <TableHead key={heading} scope="col" className="px-5">
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((customer) => (
                    <TableRow key={customer.email}>
                      <TableCell className="px-5 py-4 font-medium">{customer.name}</TableCell>
                      <TableCell className="px-5 py-4">{customer.email}</TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-4">
                        {customer.phone}
                      </TableCell>
                      <TableCell className="px-5 py-4">{customer.goal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul aria-label="Demo customers" className="divide-y divide-border md:hidden">
              {rows.map((customer) => (
                <li key={customer.email} className="space-y-3 p-4">
                  <p className="text-base font-semibold">{customer.name}</p>
                  <dl className="space-y-2 text-sm">
                    {[
                      ["Fitness goal", customer.goal],
                      ["Email", customer.email],
                      ["Phone", customer.phone],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
