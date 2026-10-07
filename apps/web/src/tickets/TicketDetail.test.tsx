import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketDetail } from "./TicketDetail.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";

const ticket = {
  id: ticketId,
  title: "Laptop will not start",
  description: "The power light flashes once.",
  setup: "Framework Laptop 13, Fedora 42",
  additionalInformation: "Started after an update.",
  status: "OPEN",
  createdAt: "2026-09-28T18:00:00.000Z",
  updatedAt: "2026-09-28T18:00:00.000Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("TicketDetail", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading status and then every ticket field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ticket));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket…");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Laptop will not start" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/tickets/${ticketId}`);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("cc04d84c")).toBeInTheDocument();
    expect(screen.getByText("The power light flashes once.")).toBeInTheDocument();
    expect(screen.getByText("Framework Laptop 13, Fedora 42")).toBeInTheDocument();
    expect(screen.getByText("Started after an update.")).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-09-28T18:00:00.000Z");
  });

  it("omits additional information when none was submitted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ...ticket, additionalInformation: null }))
    );
    render(<TicketDetail ticketId={ticketId} />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Additional information")).not.toBeInTheDocument();
  });

  it.each([404, 400])("shows a not-found message for a %i response", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "NOT_FOUND", message: "The ticket was not found" } },
            status
          )
        )
    );
    render(<TicketDetail ticketId="missing" />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ticket not found" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an accessible error and retries on request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: "INTERNAL_ERROR", message: "The ticket request could not be completed" }
          },
          500
        )
      )
      .mockResolvedValueOnce(jsonResponse(ticket));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load this ticket. Please try again."
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Laptop will not start"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
