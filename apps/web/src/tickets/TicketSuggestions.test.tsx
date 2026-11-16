import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketSuggestions } from "./TicketSuggestions.js";

function ticket(id: string, title: string, status = "OPEN") {
  return {
    id,
    title,
    description: `${title} description`,
    setup: "Setup",
    additionalInformation: null,
    status,
    replyStatus: "OPEN",
    canManageReplyStatus: false,
    priority: "MEDIUM",
    visibility: "PUBLIC",
    canReply: true,
    createdByName: null,
    createdAt: "2026-09-29T09:30:00.000Z",
    updatedAt: "2026-09-29T09:30:00.000Z",
    votes: { upvotes: 0, downvotes: 0, userVote: null }
  };
}

const printer = ticket("2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11", "Printer is offline", "RESOLVED");
const laptop = ticket("cc04d84c-9aee-4d35-8af3-999d861aaed6", "Laptop will not start");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function stubFetch(...responses: Array<{ tickets: unknown[] } | "error">) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(
      response === "error" ? jsonResponse({}, 500) : jsonResponse(response)
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function typeSearch(text: string) {
  fireEvent.change(screen.getByLabelText("Search existing tickets"), { target: { value: text } });
}

describe("TicketSuggestions", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stays quiet and does not look anything up for an empty or very short title", async () => {
    const fetchMock = stubFetch();
    const { rerender } = render(<TicketSuggestions title="" />);

    expect(screen.getByRole("heading", { level: 2, name: "Already solved?" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByPlaceholderText("Search tickets")).toBe(
      screen.getByLabelText("Search existing tickets")
    );

    rerender(<TicketSuggestions title=" Pr " />);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows tickets similar to the title, with links that open in a new tab", async () => {
    const fetchMock = stubFetch({ tickets: [printer, laptop] });
    render(<TicketSuggestions title="Printer offline" />);

    expect(screen.getByRole("heading", { level: 3, name: "Similar tickets" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Looking for similar tickets…");

    const list = await screen.findByRole("list", { name: "Similar tickets" });
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets?q=Printer+offline&match=any&limit=5");
    expect(screen.getByRole("status")).toHaveTextContent("2 similar tickets");

    const [first] = within(list).getAllByRole("listitem") as [HTMLElement];
    const link = within(first).getByRole("link", {
      name: "Printer is offline (opens in a new tab)"
    });
    expect(link).toHaveAttribute("href", "/tickets/2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11");
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(first).getByText("Resolved")).toBeInTheDocument();
    expect(within(first).getByText("Printer is offline description")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /See all results/ })).not.toBeInTheDocument();
  });

  it("waits for a pause in typing and looks up only the latest title", async () => {
    const fetchMock = stubFetch({ tickets: [printer] });
    const { rerender } = render(<TicketSuggestions title="Pri" />);
    rerender(<TicketSuggestions title="Print" />);
    rerender(<TicketSuggestions title="Printer" />);

    await screen.findByRole("list", { name: "Similar tickets" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets?q=Printer&match=any&limit=5");
    expect(screen.getByRole("status")).toHaveTextContent("1 similar ticket");
  });

  it("shows search results instead of similar tickets while the search box has text", async () => {
    const fetchMock = stubFetch({ tickets: [printer] }, { tickets: [laptop] }, { tickets: [] });
    render(<TicketSuggestions title="Printer offline" />);
    await screen.findByRole("list", { name: "Similar tickets" });

    typeSearch("laptop start");

    const list = await screen.findByRole("list", { name: "Search results" });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=laptop+start&limit=5");
    expect(within(list).getByRole("link", { name: /Laptop will not start/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 ticket matches");
    expect(screen.queryByText("Printer is offline")).not.toBeInTheDocument();

    const more = screen.getByRole("link", { name: "See all results (opens in a new tab)" });
    expect(more).toHaveAttribute("href", "/tickets?q=laptop%20start");
    expect(more).toHaveAttribute("target", "_blank");

    typeSearch("");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No similar tickets found.")
    );
    expect(fetchMock).toHaveBeenLastCalledWith("/api/tickets?q=Printer+offline&match=any&limit=5");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("reports an empty search", async () => {
    stubFetch({ tickets: [] });
    render(<TicketSuggestions title="" />);

    typeSearch("toaster");

    expect(screen.getByRole("status")).toHaveTextContent("Searching tickets…");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No tickets match your search.")
    );
    expect(screen.queryByRole("link", { name: /See all results/ })).not.toBeInTheDocument();
  });

  it("reports a failed lookup without an alert and recovers on the next one", async () => {
    stubFetch("error", { tickets: [printer] });
    const { rerender } = render(<TicketSuggestions title="Printer" />);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "We couldn't check for existing tickets. You can still create your ticket."
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<TicketSuggestions title="Printer offline" />);

    expect(await screen.findByRole("list", { name: "Similar tickets" })).toBeInTheDocument();
  });

  it("does not submit a page navigation when Enter is pressed in the search box", () => {
    stubFetch();
    render(<TicketSuggestions title="" />);

    const form = screen.getByRole("search", { name: "Existing tickets" });

    expect(fireEvent.submit(form)).toBe(false);
  });
});
