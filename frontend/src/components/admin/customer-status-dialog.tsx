import { useRef, useState, type FormEvent } from "react";
import { useDialogReturnFocus } from "@/hooks/use-dialog-return-focus";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, profileSchema, statusSchema, type Customer } from "@/lib/admin-api";
import { SectionError } from "./customer-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function CustomerStatusDialog({
  customer,
  onClose,
  onSuccess,
}: {
  customer: Customer;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const locking = !customer.is_locked;
  const returnFocus = useDialogReturnFocus();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const submitting = useRef(false);
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ["admin", "status-preview", customer.id],
    queryFn: ({ signal }) => api(`/admin/customers/${customer.id}`, profileSchema, { signal }),
    retry: false,
  });
  const count = Math.max(warningCount, profile.data?.data.unfinished_order_count ?? 0);
  const mutation = useMutation({
    mutationFn: () =>
      api(`/admin/customers/${customer.id}/status`, statusSchema, {
        method: "PATCH",
        body: JSON.stringify({
          is_locked: locking,
          reason: reason.trim(),
          confirm_unfinished_orders: locking && confirmed,
        }),
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["admin"] });
      onSuccess(
        result.changed
          ? `${result.data.full_name}'s account ${result.data.is_locked ? "locked" : "unlocked"}.`
          : "The account already has this status. No new change was recorded.",
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "UNFINISHED_ORDERS") {
        setWarningCount(error.unfinishedOrderCount);
        setConfirmed(false);
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      submitting.current ||
      !reason.trim() ||
      (locking && count > 0 && !confirmed) ||
      !profile.isSuccess
    )
      return;
    submitting.current = true;
    mutation.mutate();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={returnFocus}
        className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg motion-reduce:animate-none"
        onEscapeKeyDown={(event) => {
          if (submitting.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (submitting.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{locking ? "Lock" : "Unlock"} account</DialogTitle>
          <DialogDescription>
            {customer.full_name} · {customer.email}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {locking
            ? "This customer will lose access to signed-in services. Existing orders and plans will be kept."
            : "This customer will be able to use signed-in services again."}
        </p>
        {profile.isPending && <p role="status">Checking account and orders…</p>}
        {profile.isError && (
          <SectionError message={profile.error.message} retry={() => void profile.refetch()} />
        )}
        <form className="space-y-4" onSubmit={submit}>
          {locking && count > 0 && (
            <>
              <Alert variant="warning" role="note">
                <AlertDescription>
                  {count} unfinished {count === 1 ? "order needs" : "orders need"} attention.
                  Locking the account does not cancel or complete these orders.
                </AlertDescription>
              </Alert>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-unfinished"
                  checked={confirmed}
                  disabled={mutation.isPending}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                  className="mt-1"
                />
                <Label htmlFor="confirm-unfinished" className="leading-relaxed">
                  I have reviewed the unfinished orders and want to continue locking this account.
                </Label>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="status-reason">Reason (required)</Label>
            <Textarea
              id="status-reason"
              required
              maxLength={1000}
              value={reason}
              disabled={mutation.isPending}
              onChange={(event) => setReason(event.target.value)}
              className="text-base"
            />
          </div>
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{mutation.error.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              variant={locking ? "destructive" : "default"}
              disabled={
                mutation.isPending ||
                !profile.isSuccess ||
                !reason.trim() ||
                (locking && count > 0 && !confirmed)
              }
            >
              {mutation.isPending ? "Saving…" : locking ? "Lock account" : "Unlock account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
