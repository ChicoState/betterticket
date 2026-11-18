import { afterEach, describe, expect, it, vi } from "vitest";

import { ticketListUrl, updateTicketStatus } from "./ticket-api.js";

const ticket = {
  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  title: "Laptop will not start",
  description: "The power light flashes once.",
  setup: "Framework Laptop 13, Fedora 42",
  additionalInformation: null,
  status: "UNDER_REVIEW",
  priority: "MEDIUM",
  visibility: "PUBLIC",
  canReply: true,
  createdByName: null,
  createdAt: "2026-09-28T18:00:00.000Z",
  updatedAt: "2026-09-28T18:01:00.000Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("updateTicketStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the status request and validates the ticket response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ticket));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateTicketStatus(ticket.id, "UNDER_REVIEW")).resolves.toEqual(ticket);
    expect(fetchMock).toHaveBeenCalledWith(`/api/tickets/${ticket.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "UNDER_REVIEW" })
    });
  });

  it("exposes the API error code and status for status-update feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "FORBIDDEN", message: "Technician access is required" } },
            403
          )
        )
    );

    await expect(updateTicketStatus(ticket.id, "UNDER_REVIEW")).rejects.toMatchObject({
      name: "TicketStatusUpdateError",
      status: 403,
      code: "FORBIDDEN"
    });
  });
});

describe("ticketListUrl", () => {
  it("omits default values", () => {
    expect(ticketListUrl()).toBe("/api/tickets");
    expect(ticketListUrl("votes", { query: "   ", match: "any" })).toBe("/api/tickets");
  });

  it("encodes the sort, trimmed query, match mode, and limit", () => {
    expect(ticketListUrl("priority", { query: " wi-fi & vpn ", match: "all" })).toBe(
      "/api/tickets?sort=priority&q=wi-fi+%26+vpn"
    );
    expect(ticketListUrl("votes", { query: "printer offline", match: "any", limit: 5 })).toBe(
      "/api/tickets?q=printer+offline&match=any&limit=5"
    );
    expect(ticketListUrl("newest", { query: "printer" })).toBe(
      "/api/tickets?sort=newest&q=printer"
    );
  });
});
