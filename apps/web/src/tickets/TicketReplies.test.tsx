import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketReplies } from "./TicketReplies.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";
const repliesUrl = `/api/tickets/${ticketId}/replies`;

const firstReply = {
  id: "0b9d7c58-0a55-4d0c-8a44-0d3f5f3f9a01",
  ticketId,
  body: "Have you tried a different charger?",
  createdAt: "2026-09-29T09:30:00.000Z"
};

const secondReply = {
  id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  ticketId,
  body: "Yes, same result with a second charger.",
  createdAt: "2026-09-29T10:00:00.000Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const failure = () =>
  jsonResponse(
    { error: { code: "INTERNAL_ERROR", message: "The ticket request could not be completed" } },
    500
  );

function writeReply(body: string) {
  fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: body } });
  fireEvent.click(screen.getByRole("button", { name: "Post reply" }));
}

describe("TicketReplies", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading status and then the replies in the order returned", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ replies: [firstReply, secondReply] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading replies…");

    const replies = await screen.findAllByRole("listitem");
    expect(fetchMock).toHaveBeenCalledWith(repliesUrl);
    expect(replies.map((reply) => within(reply).getByText(/charger/).textContent)).toEqual([
      firstReply.body,
      secondReply.body
    ]);
    expect(within(replies[0]!).getByText(/./, { selector: "time" })).toHaveAttribute(
      "datetime",
      firstReply.createdAt
    );
  });

  it("shows an empty state with the reply form when there are no replies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ replies: [] })));
    render(<TicketReplies ticketId={ticketId} />);

    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toBeRequired();
  });

  it("shows an accessible error and retries on request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(jsonResponse({ replies: [firstReply] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the replies. Please try again."
    );
    expect(screen.queryByRole("button", { name: "Post reply" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(firstReply.body)).toBeInTheDocument();
  });

  it("rejects a malformed reply list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ replies: [{ id: 1 }] })));
    render(<TicketReplies ticketId={ticketId} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the replies.");
  });

  it("posts a trimmed reply, appends it, and clears the form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ replies: [firstReply] }))
      .mockResolvedValueOnce(jsonResponse(secondReply, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} />);
    await screen.findByText(firstReply.body);

    writeReply(`  ${secondReply.body}  `);

    expect(await screen.findByText("Your reply has been posted.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(repliesUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: secondReply.body })
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(secondReply.body)).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toHaveValue("");
  });

  it("disables duplicate submission while the request is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ replies: [] }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRequest = resolve;
          })
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} />);
    await screen.findByText("No replies yet.");

    writeReply(secondReply.body);

    expect(screen.getByRole("button", { name: "Posting reply…" })).toBeDisabled();

    resolveRequest?.(jsonResponse(secondReply, 201));
    await waitFor(() => expect(screen.getByRole("button", { name: "Post reply" })).toBeEnabled());
  });

  it("keeps the draft and shows an accessible error when posting fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ replies: [] }))
      .mockResolvedValueOnce(failure());
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} />);
    await screen.findByText("No replies yet.");

    writeReply(secondReply.body);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't post your reply. Please try again."
    );
    expect(screen.getByLabelText("Your reply")).toHaveValue(secondReply.body);
    expect(screen.getByText("No replies yet.")).toBeInTheDocument();
  });
});
