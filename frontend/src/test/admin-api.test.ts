import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY, api, customersSchema } from "@/lib/admin-api";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("Admin API", () => {
  it("sends the session credential and rejects a malformed success response", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "test-fixture-only");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [{ email: "incomplete" }] })),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(api("/admin/customers", customersSchema)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetch.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer test-fixture-only");
  });
  it("keeps unfinished-order confirmation separate from other failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "UNFINISHED_ORDERS",
            message: "Confirm",
            unfinished_order_count: 2,
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(api("/admin/customers/1/status", customersSchema)).rejects.toMatchObject({
      status: 409,
      code: "UNFINISHED_ORDERS",
      unfinishedOrderCount: 2,
    });
  });
  it("notifies the session guard when a previously issued token belongs to a locked account", async () => {
    const invalid = vi.fn();
    window.addEventListener("fitkitchen:session-invalid", invalid);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "ACCOUNT_LOCKED", message: "Locked" }), {
          status: 403,
        }),
      ),
    );
    try {
      await expect(api("/session", customersSchema)).rejects.toMatchObject({
        code: "ACCOUNT_LOCKED",
      });
      expect(invalid).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("fitkitchen:session-invalid", invalid);
    }
  });

  it("does not expire a new session when an earlier account's request finishes late", async () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "old-fixture");
    const invalid = vi.fn();
    window.addEventListener("fitkitchen:session-invalid", invalid);
    let finish: (response: Response) => void = () => {
      throw new Error("Request not started");
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const pending = api("/session", customersSchema);
    sessionStorage.setItem(ACCESS_TOKEN_KEY, "new-fixture");
    finish(
      new Response(JSON.stringify({ code: "UNAUTHENTICATED", message: "Old session expired" }), {
        status: 401,
      }),
    );
    try {
      await expect(pending).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      expect(invalid).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("fitkitchen:session-invalid", invalid);
    }
  });
});
