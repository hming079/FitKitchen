import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("closes with Escape and restores focus to the menu trigger", async () => {
  render(
    <AdminMobileNavigation>
      {(close) => <button onClick={close}>Customers</button>}
    </AdminMobileNavigation>,
  );
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole("dialog", { name: "Admin navigation" });
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("closes when a navigation item is selected", async () => {
  render(
    <AdminMobileNavigation>
      {(close) => <button onClick={close}>Customers</button>}
    </AdminMobileNavigation>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  fireEvent.click(await screen.findByRole("button", { name: "Customers" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("dismisses the mobile modal when the viewport switches to desktop", async () => {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  const remove = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.push(listener),
    removeEventListener: remove,
  }));
  render(
    <AdminMobileNavigation>
      {(close) => <button onClick={close}>Customers</button>}
    </AdminMobileNavigation>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  await screen.findByRole("dialog", { name: "Admin navigation" });
  act(() => listeners[0]?.({ matches: true } as MediaQueryListEvent));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  cleanup();
  expect(remove).toHaveBeenCalled();
});
