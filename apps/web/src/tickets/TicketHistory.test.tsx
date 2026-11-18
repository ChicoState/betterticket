import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketHistory } from "./TicketHistory.js";

const user = { id: "user-id", name: "Uma User", username: "uma", role: "USER" as const };
const ticket = {
  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  title: "Laptop will not start",
  description: "The power light flashes once.",
  setup: "Framework Laptop 13",
  additionalInformation: null,
  status: "IN_PROGRESS",
  replyStatus: "OPEN",
  canManageReplyStatus: true,
  priority: "HIGH",
  visibility: "PRIVATE",
  canReply: true,
  assignedTechnicianId: null,
  createdByName: "Uma User",
  createdAt: "2026-09-28T18:00:00.000Z",
  updatedAt: "2026-09-29T18:00:00.000Z"
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("TicketHistory", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires sign-in without requesting history anonymously", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketHistory currentUser={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("Sign in to view your ticket history.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading and submitted tickets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ tickets: [ticket] })));
    render(<TicketHistory currentUser={user} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your ticket history…");
    const card = await screen.findByRole("article");
    expect(within(card).getByRole("link", { name: ticket.title })).toHaveAttribute(
      "href",
      `/tickets/${ticket.id}`
    );
    expect(within(card).getByText("In progress")).toBeInTheDocument();
    expect(within(card).getByText("cc04d84c")).toBeInTheDocument();
    expect(within(card).getByText(/Submitted/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/tickets/history");
  });

  it("shows an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ tickets: [] })));
    render(<TicketHistory currentUser={user} />);

    expect(await screen.findByText("You haven't submitted any tickets yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: { message: "failure" } }, 500))
      .mockResolvedValueOnce(response({ tickets: [ticket] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketHistory currentUser={user} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your ticket history. Please try again."
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
