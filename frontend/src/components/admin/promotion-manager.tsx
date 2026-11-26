import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CatalogForm } from "@/components/admin/catalog/catalog-dialogs";
import {
  CatalogInput,
  CatalogResults,
  CatalogTable,
} from "@/components/admin/catalog/catalog-ui";
import { PageControls } from "@/components/admin/customer-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  adminPromotionsKey,
  promotionApi,
  type AdminPromotion,
  type PromotionInput,
} from "@/lib/promotion-api";
import { optionalText, textField, vnd } from "./catalog/catalog-data";

const pageSize = 50;

function PromotionEditor({
  promotion,
  onClose,
}: {
  promotion: AdminPromotion | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">(
    promotion?.discount_type ?? "PERCENTAGE",
  );
  return (
    <CatalogForm
      title={promotion ? "Edit discount code" : "Create discount code"}
      description="Discounts apply to the meal subtotal. Checkout rechecks availability and usage limits."
      submitLabel={promotion ? "Save changes" : "Create code"}
      success={promotion ? "Discount code updated." : "Discount code created."}
      queryKey={adminPromotionsKey}
      onClose={onClose}
      save={(form) => {
        const payload: PromotionInput = {
          code: textField(form, "code").trim().toUpperCase(),
          description: optionalText(form, "description"),
          discount_type: type,
          discount_value: Number(textField(form, "discount_value")),
          min_order_amount: Number(textField(form, "min_order_amount") || 0),
          max_discount_amount:
            type === "PERCENTAGE" && textField(form, "max_discount_amount")
              ? Number(textField(form, "max_discount_amount"))
              : null,
          start_date: optionalText(form, "start_date"),
          end_date: optionalText(form, "end_date"),
          usage_limit: textField(form, "usage_limit")
            ? Number(textField(form, "usage_limit"))
            : null,
          per_user_limit: textField(form, "per_user_limit")
            ? Number(textField(form, "per_user_limit"))
            : null,
          is_active: promotion?.is_active ?? true,
        };
        return promotion
          ? promotionApi.updateAdmin(promotion.id, payload)
          : promotionApi.createAdmin(payload);
      }}
    >
      {() => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label="Code"
              name="code"
              required
              minLength={1}
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              defaultValue={promotion?.code ?? ""}
              placeholder="e.g. WELCOME15"
              autoCapitalize="characters"
            />
            <div className="min-w-0 space-y-2">
              <Label htmlFor="promotion-discount-type">Discount type</Label>
              <Select
                name="discount_type"
                value={type}
                onValueChange={(value) => {
                  if (value === "PERCENTAGE" || value === "FIXED") setType(value);
                }}
              >
                <SelectTrigger id="promotion-discount-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label={type === "PERCENTAGE" ? "Discount (%)" : "Discount (VND)"}
              name="discount_value"
              type="number"
              min="0.01"
              max={type === "PERCENTAGE" ? 100 : 9999999999.99}
              step="0.01"
              required
              defaultValue={promotion?.discount_value ?? ""}
            />
            <CatalogInput
              label="Minimum order (VND)"
              name="min_order_amount"
              type="number"
              min={0}
              max={9999999999.99}
              step="0.01"
              defaultValue={promotion?.min_order_amount ?? 0}
            />
          </div>
          {type === "PERCENTAGE" && (
            <CatalogInput
              label="Maximum discount (VND, optional)"
              name="max_discount_amount"
              type="number"
              min="0.01"
              max={9999999999.99}
              step="0.01"
              defaultValue={promotion?.max_discount_amount ?? ""}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label="Starts on (optional)"
              name="start_date"
              type="date"
              defaultValue={promotion?.start_date ?? ""}
            />
            <CatalogInput
              label="Ends on (optional)"
              name="end_date"
              type="date"
              defaultValue={promotion?.end_date ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogInput
              label="Total uses (optional)"
              name="usage_limit"
              type="number"
              min={1}
              step={1}
              defaultValue={promotion?.usage_limit ?? ""}
            />
            <CatalogInput
              label="Uses per customer (optional)"
              name="per_user_limit"
              type="number"
              min={1}
              step={1}
              defaultValue={promotion?.per_user_limit ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promotion-description">Description (optional)</Label>
            <Textarea
              id="promotion-description"
              name="description"
              maxLength={500}
              defaultValue={promotion?.description ?? ""}
              className="min-h-20"
            />
          </div>
        </div>
      )}
    </CatalogForm>
  );
}

export function PromotionManager() {
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<AdminPromotion | null | undefined>(undefined);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...adminPromotionsKey, page],
    queryFn: ({ signal }) => promotionApi.listAdmin(page, signal),
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      promotionApi.updateAdmin(id, { is_active }),
    onSuccess: async (_result, { is_active }) => {
      await client.invalidateQueries({ queryKey: adminPromotionsKey });
      toast.success(is_active ? "Discount code activated." : "Discount code paused.");
    },
  });
  const promotions = query.data?.data ?? [];
  const total = query.data?.pagination.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Customers can apply a code to the meal subtotal at checkout. Cancelled orders do not count
          toward usage limits.
        </p>
        <Button className="min-h-11 gap-2" onClick={() => setEditor(null)}>
          <Plus className="size-4" aria-hidden />
          Create code
        </Button>
      </div>
      {toggle.error && (
        <p role="alert" className="text-sm text-destructive">
          {toggle.error.message}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        <CatalogResults
          query={query}
          empty={query.data && promotions.length === 0 ? "No discount codes yet." : undefined}
        >
          <CatalogTable
            name="Discount codes"
            columns={["Code", "Discount", "Minimum", "Uses", "Validity", "Status"]}
          >
            {promotions.map((promotion) => (
              <tr key={promotion.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setEditor(promotion)}
                  >
                    {promotion.code}
                  </button>
                  {promotion.description && (
                    <p className="mt-1 max-w-56 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {promotion.description}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {promotion.discount_type === "PERCENTAGE"
                    ? `${promotion.discount_value}%${promotion.max_discount_amount === null ? "" : ` · max ${vnd.format(promotion.max_discount_amount)}`}`
                    : vnd.format(promotion.discount_value)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {vnd.format(promotion.min_order_amount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums">
                  {promotion.redemption_count}
                  {promotion.usage_limit !== null && ` / ${promotion.usage_limit}`}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                  {promotion.start_date ?? "Any date"}
                  <span className="block">
                    {promotion.end_date ? `Through ${promotion.end_date}` : "No end date"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promotion.is_active}
                      disabled={toggle.isPending}
                      aria-label={`${promotion.is_active ? "Pause" : "Activate"} ${promotion.code}`}
                      onCheckedChange={(is_active) =>
                        toggle.mutate({ id: promotion.id, is_active })
                      }
                    />
                    <Badge variant={promotion.is_active ? "success" : "secondary"}>
                      {promotion.is_active ? "Enabled" : "Paused"}
                    </Badge>
                  </div>
                </td>
              </tr>
            ))}
          </CatalogTable>
          {query.data && total > pageSize && (
            <div className="border-t border-border px-4 sm:px-5">
              <PageControls
                page={page}
                total={total}
                size={pageSize}
                onChange={setPage}
                pending={query.isFetching}
              />
            </div>
          )}
        </CatalogResults>
      </div>
      {editor !== undefined && (
        <PromotionEditor promotion={editor} onClose={() => setEditor(undefined)} />
      )}
    </div>
  );
}
