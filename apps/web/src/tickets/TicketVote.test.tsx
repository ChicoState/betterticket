import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketVote } from "./TicketVote.js";
const user = { id: "user", name: "User", username: "user", role: "USER" as const };
const state = { upvotes: 3, downvotes: 1, userVote: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("TicketVote", () => {
  it("loads public totals and disables visitor controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(state));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketVote ticketId="ticket" />);
    expect(await screen.findByRole("button", { name: /Upvote ticket/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Downvote ticket/ })).toBeDisabled();
    expect(screen.getByText("Score 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets/ticket/vote");
  });
  it("loads the signed-in selection, switches it, and removes it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ...state, userVote: 1 }))
      .mockResolvedValueOnce(json({ upvotes: 2, downvotes: 2, userVote: -1 }))
      .mockResolvedValueOnce(json({ upvotes: 2, downvotes: 1, userVote: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketVote ticketId="ticket" currentUser={user} />);
    expect(await screen.findByRole("button", { name: /Upvote ticket/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /Downvote ticket/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Downvote ticket/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /Downvote ticket/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Downvote ticket/ })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    );
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/tickets/ticket/vote",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: -1 })
      }
    ]);
    expect(fetchMock.mock.calls[2]).toEqual(["/api/tickets/ticket/vote", { method: "DELETE" }]);
  });
  it("keeps voting unavailable while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<TicketVote ticketId="ticket" currentUser={user} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket votes");
    expect(screen.queryByRole("button", { name: /Upvote/ })).not.toBeInTheDocument();
  });
  it("reports a failed load and retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json(state))
    );
    render(<TicketVote ticketId="ticket" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("load the ticket votes");
    fireEvent.click(screen.getByRole("button", { name: "Retry ticket votes" }));
    expect(await screen.findByRole("button", { name: /Upvote ticket/ })).toBeDisabled();
  });
  it("rejects malformed vote data without showing false totals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ upvotes: -1, downvotes: 0, userVote: null }))
    );
    render(<TicketVote ticketId="ticket" currentUser={user} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upvote/ })).not.toBeInTheDocument();
  });
  it("reloads vote state when the signed-in account changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ...state, userVote: 1 }))
      .mockResolvedValueOnce(json({ ...state, userVote: -1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<TicketVote ticketId="ticket" currentUser={user} />);
    expect(await screen.findByRole("button", { name: /Upvote ticket/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    rerender(<TicketVote ticketId="ticket" currentUser={{ ...user, id: "other-user" }} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Downvote ticket/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
