import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AccountStatus({ locked }: { locked: boolean }) {
  return <Badge variant={locked ? "destructive" : "success"}>{locked ? "Locked" : "Active"}</Badge>;
}

export function PageControls({
  page,
  total,
  size,
  onChange,
  pending = false,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
  pending?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <p>
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={pending || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={pending || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function SectionError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="space-y-2">
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
