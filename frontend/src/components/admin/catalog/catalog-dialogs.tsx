import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/admin-api";
import { catalogKey, type CatalogAction } from "./catalog-data";

const dialogClass = "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg";

function useReturnFocus() {
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement);
  return (event: Event) => {
    event.preventDefault();
    const target = opener.current;
    if (target instanceof HTMLElement && target !== document.body && target.isConnected) {
      target.focus({ preventScroll: true });
      return;
    }
    const fallback =
      document.querySelector<HTMLElement>('[role="dialog"] [data-catalog-add]') ??
      document.querySelector<HTMLElement>(
        '[role="tabpanel"][data-state="active"] [data-catalog-add]',
      );
    fallback?.focus({ preventScroll: true });
  };
}

function useCatalogWrite<T>(
  save: (input: T) => Promise<unknown>,
  success: string,
  onClose: () => void,
  onSuccess = onClose,
) {
  const client = useQueryClient();
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: catalogKey });
      toast.success(success);
      onSuccess();
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  return {
    ...mutation,
    submit(input: T) {
      if (busy.current) return;
      busy.current = true;
      mutation.mutate(input);
    },
    dismiss() {
      if (!busy.current) onClose();
    },
  };
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function CatalogConfirm({
  action,
  onClose,
  onSuccess = onClose,
}: {
  action: CatalogAction;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const restoreFocus = useReturnFocus();
  const mutation = useCatalogWrite(action.run, action.success, onClose, onSuccess);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) mutation.dismiss();
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={() => toast.dismiss()}
        onCloseAutoFocus={restoreFocus}
        className={`${dialogClass} motion-reduce:animate-none`}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{action.title}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {action.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.error && <ErrorMessage message={mutation.error.message} />}
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel className="m-0 min-h-11" disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant={action.destructive ? "destructive" : "default"}
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={() => mutation.submit(undefined)}
          >
            {mutation.isPending ? "Saving…" : action.title}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CatalogDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const restoreFocus = useReturnFocus();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => toast.dismiss()}
        onCloseAutoFocus={restoreFocus}
        className={`${dialogClass} sm:max-w-xl [&>button:last-child]:top-2 [&>button:last-child]:right-2 [&>button:last-child]:p-2`}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function CatalogForm({
  title,
  description,
  nameConflict,
  active,
  submitLabel = "Save",
  save,
  success,
  onClose,
  children,
}: {
  title: string;
  description: string;
  nameConflict?: string;
  active?: boolean;
  submitLabel?: string;
  save: (data: FormData) => Promise<unknown>;
  success: string;
  onClose: () => void;
  children: (nameError?: string, clearError?: () => void) => ReactNode;
}) {
  const [pause, setPause] = useState<FormData | null>(null);
  const mutation = useCatalogWrite(save, success, onClose);
  const message = mutation.error?.message;
  const duplicate = mutation.error instanceof ApiError && mutation.error.code === nameConflict;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (active && !data.has("is_available")) {
      setPause(data);
    } else {
      mutation.submit(data);
    }
  }
  return (
    <CatalogDialog title={title} description={description} onClose={mutation.dismiss}>
      <form onSubmit={submit}>
        <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
          {children(duplicate ? message : undefined, duplicate ? mutation.reset : undefined)}
          {message && !duplicate && <ErrorMessage message={message} />}
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={mutation.dismiss}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11">
              {mutation.isPending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </fieldset>
      </form>
      {pause && (
        <CatalogConfirm
          action={{
            title: "Pause sales",
            description: "Save these changes and take this item off sale?",
            destructive: true,
            run: () => save(pause),
            success,
          }}
          onClose={() => setPause(null)}
          onSuccess={onClose}
        />
      )}
    </CatalogDialog>
  );
}

export function DescriptionField({ value }: { value: string | null | undefined }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Description</Label>
      <Textarea id={id} name="description" rows={3} defaultValue={value ?? ""} />
    </div>
  );
}

export function AvailableField({ available }: { available: boolean | null }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-2">
      <Checkbox id={id} name="is_available" defaultChecked={available === true} />
      <Label htmlFor={id} className="flex min-h-11 items-center">
        Available for sale
      </Label>
    </div>
  );
}
