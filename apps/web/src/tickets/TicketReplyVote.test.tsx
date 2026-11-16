import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketReplyVote } from "./ticket_voted_solution.js";
const props = { ticketId: "ticket", replyId: "reply", upvotes: 2, downvotes: 1, userVote: null };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("authenticated reply voting", () => {
  it("disables visitor voting and offers sign-in", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplyVote {...props} />);
    expect(screen.getByRole("button", { name: /Upvote/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Downvote/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Sign in/ })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: /Upvote/ }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses server totals, switches direction, and removes the same vote", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ upvotes: 4, downvotes: 1, userVote: 1 }))
      .mockResolvedValueOnce(json({ upvotes: 3, downvotes: 2, userVote: -1 }))
      .mockResolvedValueOnce(json({ upvotes: 3, downvotes: 1, userVote: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplyVote {...props} canVote />);
    fireEvent.click(screen.getByRole("button", { name: /Upvote/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Upvote/ })).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.getByText("Score 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Downvote/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Downvote/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /Downvote/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Downvote/ })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    );
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["PUT", "PUT", "DELETE"]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ value: -1 });
  });
  it("prevents duplicate requests while saving", async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplyVote {...props} canVote />);
    fireEvent.click(screen.getByRole("button", { name: /Upvote/ }));
    fireEvent.click(screen.getByRole("button", { name: /Downvote/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Downvote/ })).toBeDisabled();
  });
  it.each([500, 401])("shows a failed save (%s) without changing totals", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, status)));
    render(<TicketReplyVote {...props} canVote />);
    fireEvent.click(screen.getByRole("button", { name: /Upvote/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 401 ? "Sign in" : "try again"
    );
    expect(screen.getByText("Score 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upvote/ })).toHaveAttribute("aria-pressed", "false");
    if (status === 401) expect(screen.getByRole("button", { name: /Downvote/ })).toBeDisabled();
  });
  it("restores the stored selection on mount", () => {
    render(<TicketReplyVote {...props} userVote={-1} canVote />);
    expect(screen.getByRole("button", { name: /Downvote/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
