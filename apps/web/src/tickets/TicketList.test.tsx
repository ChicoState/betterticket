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
    replyStatus: "CLOSED",
    canManageReplyStatus: false,
    priority: "HIGH",
    visibility: "AUTHENTICATED",
    canReply: true,
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
    replyStatus: "OPEN",
    canManageReplyStatus: false,
    priority: "LOW",
    visibility: "PUBLIC",
    canReply: true,
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
    window.history.replaceState({}, "", "/");
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
    expect(within(printer).getByText("High", { selector: ".priority-badge" })).toBeInTheDocument();
    expect(
      within(printer).getByText("Closed to replies", { selector: ".reply-status-badge" })
    ).toBeInTheDocument();
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

  it("sorts by most votes by default", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketList />);

    await screen.findAllByRole("article");

    expect(screen.getByLabelText("Sort tickets")).toHaveValue("votes");
    expect(screen.getByRole("option", { name: "Most Votes" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets");
  });

  it("requests priority sorting when the sorting control changes", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketList />);

    await screen.findAllByRole("article");
    fireEvent.change(screen.getByLabelText("Sort tickets"), { target: { value: "priority" } });
    await screen.findAllByRole("article");

    expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?sort=priority");
  });

  it("keeps the sorting control mounted and focused while reloading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ tickets })))
    );
    render(<TicketList />);

    await screen.findAllByRole("article");
    const sortControl = screen.getByLabelText("Sort tickets");
    sortControl.focus();
    fireEvent.change(sortControl, { target: { value: "priority" } });

    expect(screen.getByRole("status")).toHaveTextContent("Loading tickets…");
    expect(screen.getByLabelText("Sort tickets")).toBe(sortControl);
    expect(sortControl).toHaveFocus();

    await screen.findAllByRole("article");
    expect(screen.getByLabelText("Sort tickets")).toBe(sortControl);
    expect(sortControl).toHaveFocus();
  });

  it("lets users change the sort after a failed load", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tickets }))
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

    await screen.findAllByRole("article");
    fireEvent.change(screen.getByLabelText("Sort tickets"), { target: { value: "priority" } });
    await screen.findByRole("alert");

    fireEvent.change(screen.getByLabelText("Sort tickets"), { target: { value: "newest" } });

    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?sort=newest");
  });

  describe("search", () => {
    function type(text: string) {
      fireEvent.change(screen.getByLabelText("Search tickets"), { target: { value: text } });
    }

    it("searches as the visitor types, reports the matches, and keeps the query in the URL", async () => {
      let respond: (response: Response) => void = () => {};
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ tickets }))
        .mockReturnValueOnce(new Promise<Response>((resolve) => (respond = resolve)));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets");
      render(<TicketList />);
      await screen.findAllByRole("article");

      expect(screen.getByRole("search")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search tickets")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
      type("  printer & driver  ");

      expect(await screen.findByRole("status")).toHaveTextContent("Searching tickets…");
      // The previous tickets stay visible until the results arrive.
      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");

      respond(jsonResponse({ tickets: [tickets[0]] }));

      expect(await screen.findByText("1 ticket matches “printer & driver”.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=printer+%26+driver");
      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(screen.getByRole("list", { name: "Matching tickets" })).toHaveAttribute(
        "aria-busy",
        "false"
      );
      expect(window.location.pathname).toBe("/tickets");
      expect(new URLSearchParams(window.location.search).get("q")).toBe("printer & driver");
    });

    it("waits for a pause in typing and searches only for the latest text", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
      vi.stubGlobal("fetch", fetchMock);
      render(<TicketList />);
      await screen.findAllByRole("article");

      type("p");
      type("pr");
      type("printer");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await screen.findByText("2 tickets match “printer”.");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=printer");
    });

    it("searches at once when the form is submitted", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
      vi.stubGlobal("fetch", fetchMock);
      render(<TicketList />);
      await screen.findAllByRole("article");

      type("laptop");
      fireEvent.submit(screen.getByRole("search"));

      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=laptop");
      await screen.findByText("2 tickets match “laptop”.");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("starts with the search from the page URL and keeps it when the sort changes", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets?q=laptop");
      render(<TicketList />);

      expect(screen.getByRole("status")).toHaveTextContent("Searching tickets…");
      expect(await screen.findByText("2 tickets match “laptop”.")).toBeInTheDocument();
      expect(screen.getByLabelText("Search tickets")).toHaveValue("laptop");
      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=laptop");

      fireEvent.change(screen.getByLabelText("Sort tickets"), { target: { value: "priority" } });
      await screen.findByText("2 tickets match “laptop”.");

      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?sort=priority&q=laptop");
    });

    it("explains an empty result and offers the new-ticket form", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ tickets: [] })));
      window.history.replaceState({}, "", "/tickets?q=toaster");
      render(<TicketList />);

      expect(await screen.findByText("No tickets match “toaster”.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "create a ticket" })).toHaveAttribute("href", "/new");
      expect(screen.queryByText("No tickets have been submitted yet.")).not.toBeInTheDocument();
    });

    it("clears the search at once and returns to the full list", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ tickets: [] }))
        .mockResolvedValueOnce(jsonResponse({ tickets }));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets?q=toaster");
      render(<TicketList />);
      await screen.findByText("No tickets match “toaster”.");

      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets");
      expect(await screen.findAllByRole("article")).toHaveLength(2);
      expect(screen.getByRole("list", { name: "Submitted tickets" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search tickets")).toHaveValue("");
      expect(window.location.search).toBe("");
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });

    it("returns to the full list when the search box is emptied", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ tickets })));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets?q=laptop");
      render(<TicketList />);
      await screen.findByText("2 tickets match “laptop”.");

      type("   ");

      await screen.findByRole("list", { name: "Submitted tickets" });
      expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets");
      expect(window.location.search).toBe("");
    });

    it("shows the load error for a failed search and searches again on new text", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse({ tickets }));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets?q=laptop");
      render(<TicketList />);

      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the tickets.");
      expect(screen.getByLabelText("Search tickets")).toHaveValue("laptop");
      expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();

      type("printer");

      expect(await screen.findByText("2 tickets match “printer”.")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps a failed search's error until the text changes and retries it on submit", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, 500))
        .mockResolvedValueOnce(jsonResponse({ tickets }));
      vi.stubGlobal("fetch", fetchMock);
      window.history.replaceState({}, "", "/tickets?q=laptop");
      render(<TicketList />);
      await screen.findByRole("alert");

      // Only whitespace changed, so this is still the failed search, not a new one.
      type("laptop ");
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      fireEvent.submit(screen.getByRole("search"));

      expect(await screen.findByText("2 tickets match “laptop”.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
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
