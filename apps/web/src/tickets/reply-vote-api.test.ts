import { afterEach, describe, expect, it, vi } from "vitest";
import { setReplyVote } from "./ticket-api.js";
afterEach(() => vi.unstubAllGlobals());
describe("vote response validation", () => {
  it.each([
    { upvotes: -1, downvotes: 0, userVote: null },
    { upvotes: 1, downvotes: 0, userVote: 2 },
    { upvotes: 1.5, downvotes: 0, userVote: 1 },
    {}
  ])("rejects invalid vote state %j", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    );
    await expect(setReplyVote("ticket", "reply", 1)).rejects.toThrow("invalid response");
  });
  it("encodes identifiers and sends only the direction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ upvotes: 1, downvotes: 0, userVote: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    await setReplyVote("ticket/id", "reply/id", 1);
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets/ticket%2Fid/replies/reply%2Fid/vote", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: 1 })
    });
  });
});
