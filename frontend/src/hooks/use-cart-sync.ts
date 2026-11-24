import { useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";

export function useCartSync() {
  useEffect(() => {
    const sync = () => {
      if (sessionStorage.getItem(ACCESS_TOKEN_KEY)) void useCartStore.getState().loadCart();
      else useCartStore.getState().reset();
    };
    const reset = () => useCartStore.getState().reset();
    sync();
    window.addEventListener("fitkitchen:session-change", sync);
    window.addEventListener("fitkitchen:session-invalid", reset);
    return () => {
      window.removeEventListener("fitkitchen:session-change", sync);
      window.removeEventListener("fitkitchen:session-invalid", reset);
    };
  }, []);
}
