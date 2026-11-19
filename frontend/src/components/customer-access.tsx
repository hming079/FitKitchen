import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { api, sessionSchema } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";

export function CustomerAccess({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useQuery({
    queryKey: ["session", "customer"],
    queryFn: ({ signal }) => api("/session", sessionSchema, { signal }),
    retry: false,
    gcTime: 0,
  });

  useEffect(() => {
    if (session.data?.data.role === "ADMIN") void navigate({ to: "/admin", replace: true });
  }, [navigate, session.data?.data.role]);

  if (session.isPending) {
    return (
      <main className="p-6">
        <p role="status">Checking your session…</p>
      </main>
    );
  }
  if (session.isError || session.data?.data.role !== "CUSTOMER") {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6 text-foreground">
        <h1 className="font-display text-2xl font-semibold">Sign in required</h1>
        <p className="text-sm text-muted-foreground">
          {session.error?.message || "Your account is not a customer account."}
        </p>
        <Button asChild>
          <Link to="/login">Go to sign in</Link>
        </Button>
      </main>
    );
  }
  return children;
}
