import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthApiError, getCurrentUser, logout } from "./auth-api.js";

describe("session API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns anonymous when the API reports no active session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/sessions/current");
  });

  it("returns the safe current user for an active session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
            name: "Uma User",
            username: "uma",
            role: "USER"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    await expect(getCurrentUser()).resolves.toMatchObject({ username: "uma" });
  });

  it("surfaces an unsuccessful logout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(logout()).rejects.toBeInstanceOf(AuthApiError);
    expect(fetch).toHaveBeenCalledWith("/api/sessions/current", { method: "DELETE" });
  });
});
