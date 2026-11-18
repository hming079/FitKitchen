import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ACCESS_TOKEN_KEY, api, sessionSchema, type Session } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminAccess({ children }: { children: (user: Session) => ReactNode }) {
  const client = useQueryClient();
  const [revision, setRevision] = useState(0);
  const [invalid, setInvalid] = useState("");
  const session = useQuery({
    queryKey: ["session", revision],
    queryFn: ({ signal }) => api("/session", sessionSchema, { signal }),
    retry: false,
    gcTime: 0,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    function changed() {
      setInvalid("");
      client.removeQueries({ queryKey: ["admin"] });
      setRevision((value) => value + 1);
    }
    function expired(event: Event) {
      setInvalid((event as CustomEvent<string>).detail);
      client.removeQueries({ queryKey: ["admin"] });
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    window.addEventListener("fitkitchen:session-change", changed);
    window.addEventListener("fitkitchen:session-invalid", expired);
    return () => {
      window.removeEventListener("fitkitchen:session-change", changed);
      window.removeEventListener("fitkitchen:session-invalid", expired);
    };
  }, [client]);

  if (session.isPending && !invalid)
    return (
      <main className="p-6">
        <p role="status">Checking your session…</p>
      </main>
    );
  if (invalid || session.isError || session.data?.data.role !== "ADMIN") {
    const message =
      invalid || session.error?.message || "This area is available to administrators only.";
    return (
      <main className="mx-auto max-w-lg space-y-5 p-6 text-foreground">
        <h1 className="font-display text-2xl font-semibold">Admin access</h1>
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Sign in with an administrator account to open this workspace.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setInvalid("");
              void session.refetch();
            }}
          >
            Check session again
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </main>
    );
  }
  return children(session.data.data);
}
