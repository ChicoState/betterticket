import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketList } from "./TicketList.js";

const tickets = [
  {
    id: "2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11",
    votes: { upvotes: 0, downvotes: 0, userVote: null },
    title: "Printer is offline",
    description: "Jobs stay queued.",
    setup: "Office printer, macOS 15",
    additionalInformation: null,
    status: "IN_PROGRESS",
    createdByName: "Terry Technician",
    createdAt: "2026-09-29T09:30:00.000Z",
    updatedAt: "2026-09-29T09:30:00.000Z"
  },
  {
    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
    votes: { upvotes: 0, downvotes: 0, userVote: null },
    title: "Laptop will not start",
    description: "The power light flashes once.",
    setup: "Framework Laptop 13, Fedora 42",
    additionalInformation: "Started after an update.",
    status: "OPEN",
    createdByName: null,
    createdAt: "2026-09-28T18:00:00.000Z",
    updatedAt: "2026-09-28T18:00:00.000Z"
  }
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("TicketList", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading status and then the tickets in API order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tickets }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketList />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading tickets…");

    const items = await screen.findAllByRole("article");
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets");
    expect(
      items.map((item) => within(item).getByRole("heading", { level: 2 }).textContent)
    ).toEqual(["Printer is offline", "Laptop will not start"]);

    const [printer, laptop] = items as [HTMLElement, HTMLElement];
    expect(within(printer).getByText("In progress")).toBeInTheDocument();
    expect(within(printer).getByText("2f1c5b0e")).toBeInTheDocument();
    expect(within(printer).getByText("Jobs stay queued.")).toBeInTheDocument();
    expect(within(printer).getByText(/Created by Terry Technician/)).toBeInTheDocument();
    expect(within(laptop).getByText(/Created by Anonymous/)).toBeInTheDocument();
    expect(printer.querySelector("time")).toHaveAttribute("datetime", "2026-09-29T09:30:00.000Z");
    expect(within(printer).getByRole("link", { name: "Printer is offline" })).toHaveAttribute(
      "href",
      "/tickets/2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11"
    );
    expect(within(laptop).getByRole("link", { name: "Laptop will not start" })).toHaveAttribute(
      "href",
      "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6"
    );
  });

  it("shows an empty state when no tickets exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ tickets: [] })));
    render(<TicketList />);

    expect(await screen.findByText("No tickets have been submitted yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
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
      .mockResolvedValueOnce(jsonResponse({ tickets }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the tickets. Please try again."
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a malformed response as a load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ tickets: [{ id: 1 }] })));
    render(<TicketList />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
  it("shows public totals and disabled vote controls on every ticket card", async () => {
    const votedTickets = tickets.map((ticket) => ({
      ...ticket,
      votes: { upvotes: 3, downvotes: 1, userVote: null }
    }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tickets: votedTickets }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketList />);
    const cards = await screen.findAllByRole("article");
    for (const card of cards) {
      expect(within(card).getByRole("button", { name: /Upvote/ })).toBeDisabled();
      expect(within(card).getByRole("button", { name: /Downvote/ })).toBeDisabled();
      expect(within(card).getByText("Score 2")).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("votes, switches, and removes directly from the list without affecting another ticket", async () => {
    const votedTickets = tickets.map((ticket) => ({
      ...ticket,
      votes: { upvotes: 0, downvotes: 0, userVote: null }
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tickets: votedTickets }))
      .mockResolvedValueOnce(jsonResponse({ upvotes: 1, downvotes: 0, userVote: 1 }))
      .mockResolvedValueOnce(jsonResponse({ upvotes: 0, downvotes: 1, userVote: -1 }))
      .mockResolvedValueOnce(jsonResponse({ upvotes: 0, downvotes: 0, userVote: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TicketList currentUser={{ id: "user", name: "User", username: "user", role: "USER" }} />
    );
    const [first, second] = await screen.findAllByRole("article");
    const up = within(first!).getByRole("button", { name: /Upvote/ });
    const down = within(first!).getByRole("button", { name: /Downvote/ });
    fireEvent.click(up);
    await waitFor(() => expect(up).toHaveAttribute("aria-pressed", "true"));
    expect(within(second!).getByText("Score 0")).toBeInTheDocument();
    fireEvent.click(down);
    await waitFor(() => expect(down).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(down);
    await waitFor(() => expect(down).toHaveAttribute("aria-pressed", "false"));
    expect(fetchMock.mock.calls.slice(1).map((call) => call[1].method)).toEqual([
      "PUT",
      "PUT",
      "DELETE"
    ]);
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/tickets/${tickets[0]!.id}/vote`);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(within(first!).getByRole("link", { name: tickets[0]!.title })).toBeInTheDocument();
  });

  it("reloads private selections and disables controls when the viewer signs out", async () => {
    const makeTickets = (userVote: 1 | null) =>
      tickets.map((ticket) => ({ ...ticket, votes: { upvotes: 1, downvotes: 0, userVote } }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tickets: makeTickets(1) }))
      .mockResolvedValueOnce(jsonResponse({ tickets: makeTickets(null) }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <TicketList currentUser={{ id: "user", name: "User", username: "user", role: "USER" }} />
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Upvote/ })[0]).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    rerender(<TicketList currentUser={null} />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Upvote/ })[0]).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    );
    expect(screen.getAllByRole("button", { name: /Upvote/ })[0]).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
