import { useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";

export function useCartSync() {
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      await useCartStore.persist.rehydrate();
      if (mounted) await useCartStore.getState().syncCart();
    };
    void sync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void useCartStore.getState().syncCart();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}