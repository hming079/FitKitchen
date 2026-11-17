import { useRef } from "react";

// These controlled dialogs are opened from repeated table/list actions, rather
// than a single Radix DialogTrigger. Retain the actual desktop/mobile opener.
export function useDialogReturnFocus() {
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement);
  return (event: Event) => {
    event.preventDefault();
    const target = opener.current;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
    else document.getElementById("customer-search")?.focus();
  };
}
