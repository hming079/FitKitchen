import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, LoaderCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ACCESS_TOKEN_KEY, api, sessionSchema } from "@/lib/admin-api";
import {
  openVnpayPage,
  orderApi,
  type Address,
  type CheckoutOrder,
  type PaymentMethod,
} from "@/lib/order-api";
import { useCartStore } from "@/stores/cart-store";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const today = () => new Date().toLocaleDateString("sv-SE");
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("sv-SE");
};

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(tomorrow);
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [message, setMessage] = useState("");
  const [placedOrder, setPlacedOrder] = useState<CheckoutOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [paymentError, setPaymentError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const queryClient = useQueryClient();
  const { items, itemCount, subtotal, isLoading, error, loadCart, updateQuantity, removeItem } =
    useCartStore();
  const hasToken =
    typeof window !== "undefined" && Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));
  const session = useQuery({
    queryKey: ["session", "cart-checkout"],
    queryFn: () => api("/session", sessionSchema),
    enabled: open && checkoutOpen && hasToken,
    retry: false,
  });
  const user = session.data?.data.role === "CUSTOMER" ? session.data.data : null;
  const addresses = useQuery({
    queryKey: ["customer", "addresses", user?.id],
    queryFn: ({ signal }) => orderApi.addresses(user!.id, signal),
    enabled: Boolean(user),
    retry: false,
  });
  const saveAddress = useMutation({
    mutationFn: () =>
      orderApi.saveAddress(user!.id, {
        recipient_name: recipientName.trim(),
        phone: phone.trim(),
        address_detail: addressDetail.trim(),
        is_default: (addresses.data?.data.length ?? 0) === 0,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["customer", "addresses", user?.id] });
      setSelectedAddressId(response.data.id);
      setAddingAddress(false);
      setRecipientName("");
      setPhone("");
      setAddressDetail("");
      setMessage("");
    },
    onError: (failure) =>
      setMessage(failure instanceof Error ? failure.message : "Could not save the address."),
  });
  // Leaves the storefront only for the VNPay Sandbox origin.
  function openVnpay(redirectUrl: string | null | undefined) {
    const opened = openVnpayPage(redirectUrl);
    setRedirecting(opened);
    return opened;
  }
  const checkout = useMutation({
    mutationFn: () =>
      orderApi.checkout({
        address_id: selectedAddressId,
        delivery_date: deliveryDate,
        payment_method: paymentMethod,
      }),
    onSuccess: async (response) => {
      setPlacedOrder(response.data);
      setCheckoutOpen(false);
      setMessage("");
      setPaymentError("");
      await loadCart();
      await queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      if (
        response.data.payment_method === "ONLINE" &&
        !openVnpay(response.data.payment?.redirect_url)
      )
        setPaymentError("The VNPay payment page could not be opened.");
    },
    onError: (failure) =>
      setMessage(failure instanceof Error ? failure.message : "Could not place your order."),
  });
  const retryPayment = useMutation({
    mutationFn: (orderId: string) => orderApi.createVnpayPayment(orderId),
    onMutate: () => setPaymentError(""),
    onSuccess: (response) => {
      if (!openVnpay(response.data.redirect_url))
        setPaymentError("The VNPay payment page could not be opened.");
    },
    onError: (failure) =>
      setPaymentError(
        failure instanceof Error ? failure.message : "Could not start the VNPay payment.",
      ),
  });

  useEffect(() => {
    if (open) void loadCart();
  }, [open, loadCart]);
  useEffect(() => {
    const list = addresses.data?.data;
    if (!list?.length) return;
    if (!selectedAddressId || !list.some(({ id }) => id === selectedAddressId))
      setSelectedAddressId((list.find(({ is_default }) => is_default) ?? (list[0] as Address)).id);
  }, [addresses.data, selectedAddressId]);

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    saveAddress.mutate();
  }
  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    checkout.mutate();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCheckoutOpen(false);
          setPlacedOrder(null);
          setPaymentError("");
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-11 rounded-sm border-foreground/15 bg-background"
          aria-label={`Open cart, ${itemCount} items`}
        >
          <ShoppingBag className="size-[19px]" />
          <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-brand-highlight text-[11px] font-bold text-brand-highlight-foreground">
            {itemCount}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 border-l border-border bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-6 text-left">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Your order
          </p>
          <SheetTitle className="font-display text-2xl">
            Cart <span className="text-muted-foreground">({itemCount})</span>
          </SheetTitle>
          <SheetDescription>
            Review meals and choose a delivery address at checkout.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6">
          {placedOrder ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="font-display text-2xl font-semibold">Order placed</p>
              {placedOrder.payment_method !== "ONLINE" ? (
                <p className="text-sm text-muted-foreground">
                  Order #{placedOrder.id} is pending confirmation. Payment is cash on delivery.
                </p>
              ) : redirecting ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Order #{placedOrder.id} was created. Opening VNPay to complete payment…
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Order #{placedOrder.id} was created and is waiting for VNPay payment.
                  </p>
                  {paymentError && (
                    <p role="alert" className="text-sm text-destructive">
                      {paymentError} You can try again now or pay later from Your orders.
                    </p>
                  )}
                  <Button
                    className="min-h-11"
                    disabled={retryPayment.isPending}
                    onClick={() => retryPayment.mutate(placedOrder.id)}
                  >
                    {retryPayment.isPending ? "Opening VNPay…" : "Try payment again"}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="min-h-11"
                disabled={redirecting || retryPayment.isPending}
                onClick={() => {
                  setPlacedOrder(null);
                  setPaymentError("");
                }}
              >
                Continue shopping
              </Button>
            </div>
          ) : isLoading && !items.length ? (
            <p
              role="status"
              className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" /> Loading your cart
            </p>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <ShoppingBag className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-display text-xl">Your cart is empty.</p>
              <Button variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
                Explore the menu
              </Button>
              {!hasToken && (
                <p className="text-sm text-muted-foreground">Sign in to use your saved cart.</p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <article key={item.id} className="flex gap-3 py-5">
                  <div className="size-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold [overflow-wrap:anywhere]">{item.name}</h3>
                    {item.customizations.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.customizations.map(({ name }) => name).join(", ")}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-semibold">{money.format(item.unit_price)}</p>
                    <div className="mt-3 flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-sm"
                        aria-label={`Decrease ${item.name} quantity`}
                        disabled={isLoading}
                        onClick={() =>
                          item.quantity === 1
                            ? void removeItem(item.id)
                            : void updateQuantity(item.id, item.quantity - 1)
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-sm"
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={isLoading || item.quantity >= 99}
                        onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1 size-9 rounded-sm text-muted-foreground"
                        aria-label={`Remove ${item.name}`}
                        disabled={isLoading}
                        onClick={() => void removeItem(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="shrink-0 pt-1 text-sm font-semibold tabular-nums">
                    {money.format(item.line_total)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 && !placedOrder && (
          <div className="space-y-3 border-t border-border bg-background px-5 py-4 sm:px-6">
            {checkoutOpen ? (
              !hasToken ? (
                <p role="alert" className="text-sm text-destructive">
                  Sign in with a customer account to check out.
                </p>
              ) : session.isPending ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Checking your account…
                </p>
              ) : session.data?.data.role !== "CUSTOMER" ? (
                <p role="alert" className="text-sm text-destructive">
                  Customer checkout requires a customer account.
                </p>
              ) : (
                <form onSubmit={submitOrder} className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="cart-delivery-address">Delivery address</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setAddingAddress(!addingAddress);
                          setMessage("");
                        }}
                      >
                        {" "}
                        {addingAddress ? "Choose saved" : "Add address"}
                      </Button>
                    </div>
                    {addresses.isPending ? (
                      <p role="status" className="text-sm text-muted-foreground">
                        Loading saved addresses…
                      </p>
                    ) : addresses.isError ? (
                      <p role="alert" className="text-sm text-destructive">
                        Could not load your addresses.
                      </p>
                    ) : addresses.data.data.length > 0 && !addingAddress ? (
                      <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                        <SelectTrigger id="cart-delivery-address" className="min-h-11">
                          <SelectValue placeholder="Choose an address" />
                        </SelectTrigger>
                        <SelectContent>
                          {addresses.data.data.map((address) => (
                            <SelectItem key={address.id} value={address.id} className="min-h-11">
                              {address.recipient_name} · {address.phone} · {address.address_detail}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : !addingAddress ? (
                      <p className="text-sm text-muted-foreground">
                        Add a delivery address to place your order.
                      </p>
                    ) : null}
                  </div>
                  {addingAddress && (
                    <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="cart-recipient">Recipient</Label>
                          <Input
                            id="cart-recipient"
                            className="h-11"
                            maxLength={150}
                            required
                            value={recipientName}
                            onChange={(event) => setRecipientName(event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cart-phone">Phone</Label>
                          <Input
                            id="cart-phone"
                            className="h-11"
                            maxLength={20}
                            required
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cart-address">Street address</Label>
                        <Input
                          id="cart-address"
                          className="h-11"
                          maxLength={500}
                          required
                          value={addressDetail}
                          onChange={(event) => setAddressDetail(event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={saveAddress.isPending}
                        onClick={() => {
                          if (!recipientName.trim() || !phone.trim() || !addressDetail.trim()) {
                            setMessage("Fill in recipient, phone, and street address.");
                            return;
                          }
                          saveAddress.mutate();
                        }}
                      >
                        {saveAddress.isPending ? "Saving…" : "Save address"}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="cart-delivery-date">Delivery date</Label>
                    <Input
                      id="cart-delivery-date"
                      type="date"
                      min={today()}
                      className="h-11 text-base"
                      required
                      value={deliveryDate}
                      onChange={(event) => setDeliveryDate(event.target.value)}
                    />
                  </div>
                  <fieldset className="space-y-1.5">
                    <legend className="text-sm font-medium">Payment method</legend>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                      className="grid grid-cols-2 gap-2"
                      disabled={checkout.isPending}
                    >
                      {(
                        [
                          ["COD", "Cash on delivery"],
                          ["ONLINE", "VNPay"],
                        ] as const
                      ).map(([value, label]) => (
                        <Label
                          key={value}
                          htmlFor={`cart-payment-${value}`}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 font-normal has-[[data-state=checked]]:border-primary"
                        >
                          <RadioGroupItem id={`cart-payment-${value}`} value={value} />
                          {label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                  <p className="text-xs text-muted-foreground">
                    {paymentMethod === "ONLINE"
                      ? "You will continue to VNPay to pay after placing the order. "
                      : "Pay the courier when your meals arrive. "}
                    Shipping is currently free.
                  </p>
                  {message && (
                    <p role="alert" className="text-sm text-destructive">
                      {message}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 flex-1"
                      onClick={() => {
                        setCheckoutOpen(false);
                        setMessage("");
                      }}
                    >
                      Back to cart
                    </Button>
                    <Button
                      type="submit"
                      className="min-h-11 flex-1"
                      disabled={
                        checkout.isPending ||
                        !selectedAddressId ||
                        addingAddress ||
                        addresses.isError
                      }
                    >
                      {checkout.isPending
                        ? "Placing order…"
                        : paymentMethod === "ONLINE"
                          ? `Pay with VNPay · ${money.format(subtotal)}`
                          : `Place order · ${money.format(subtotal)}`}
                    </Button>
                  </div>
                </form>
              )
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">{money.format(subtotal)}</span>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  className="h-12 w-full"
                  disabled={isLoading || !hasToken}
                  onClick={() => {
                    setCheckoutOpen(true);
                    setMessage("");
                  }}
                >
                  Checkout <ArrowUpRight className="size-4" />
                </Button>
                {!hasToken && (
                  <p className="text-center text-sm text-muted-foreground">
                    Sign in to continue to checkout.
                  </p>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  Total {money.format(subtotal)} · Cash on delivery or VNPay
                </p>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
