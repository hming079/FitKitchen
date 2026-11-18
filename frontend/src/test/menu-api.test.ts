import { afterEach, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "@/lib/admin-api";
import { menuApi } from "@/lib/menu-api";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("uses the public API origin, escapes path segments and leaves the admin session alone", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://public.example.test/");
  sessionStorage.setItem(ACCESS_TOKEN_KEY, "test-session");
  const dispatch = vi.spyOn(window, "dispatchEvent");
  const fetch = vi.fn(async () => new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  const { signal } = new AbortController();
  try {
    await expect(menuApi.getMeal("1/2", signal)).rejects.toMatchObject({
      status: 401,
      unavailable: false,
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith("https://public.example.test/api/meals/1%2F2", {
      credentials: "omit",
      signal,
    });
    expect(dispatch).not.toHaveBeenCalled();
  } finally {
    dispatch.mockRestore();
  }
});

it("distinguishes a server outage from an unexpected successful response", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response("<html>Unexpected response</html>"));
  vi.stubGlobal("fetch", fetch);
  await expect(menuApi.listMeals({}, 1)).rejects.toMatchObject({ status: 503, unavailable: true });
  await expect(menuApi.listMeals({}, 1)).rejects.toMatchObject({ status: 200, unavailable: false });
});

it("preserves query cancellation instead of treating it as an outage", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Cancelled", "AbortError");
  controller.abort(reason);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(reason));
  await expect(menuApi.listMeals({}, 1, controller.signal)).rejects.toBe(reason);
});
