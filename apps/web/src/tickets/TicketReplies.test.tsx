import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sortSolutions, TicketReplies } from "./TicketReplies.js";
import type { Reply } from "./ticket-api.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";
const repliesUrl = `/api/tickets/${ticketId}/replies`;

const firstReply: Reply = {
  id: "0b9d7c58-0a55-4d0c-8a44-0d3f5f3f9a01",
  kind: "COMMENT",
  body: "Have you tried a different charger?",
  createdAt: "2026-09-29T09:30:00.000Z",
  endorsements: []
};

const secondReply: Reply = {
  id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  kind: "COMMENT",
  body: "Yes, same result with a second charger.",
  createdAt: "2026-09-29T10:00:00.000Z",
  endorsements: []
};

function solution(id: string, body: string, endorsementCount: number): Reply {
  return {
    id,
    kind: "SOLUTION",
    body,
    createdAt: "2026-09-29T11:00:00.000Z",
    endorsements: Array.from({ length: endorsementCount }, (_, index) => ({
      id: `${id}-endorsement-${index}`,
      technicianName: `Technician ${index + 1}`,
      notes: index === 0 ? `Notes for ${body}` : null,
      createdAt: "2026-09-29T12:00:00.000Z",
      updatedAt: "2026-09-29T12:00:00.000Z",
      isOwn: false
    }))
  };
}

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

function writeReply(body: string, kind = "Add a comment") {
  fireEvent.click(screen.getByLabelText(kind));
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
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);

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

  it("shows empty states with the reply form when there are no replies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ replies: [] })));
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);

    expect(await screen.findByText("No suggested solutions yet.")).toBeInTheDocument();
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toBeRequired();
    expect(screen.getByLabelText("Suggest a solution")).toBeRequired();
    expect(screen.getByLabelText("Suggest a solution")).not.toBeChecked();
    expect(screen.getByLabelText("Add a comment")).not.toBeChecked();
  });

  it("groups solutions above the discussion with endorsed solutions first", async () => {
    const unendorsed = solution("a0000000-0000-4000-8000-000000000001", "Restart the spooler", 0);
    const oneEndorsement = solution("a0000000-0000-4000-8000-000000000002", "Update firmware", 1);
    const twoEndorsements = solution("a0000000-0000-4000-8000-000000000003", "Reinstall driver", 2);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ replies: [unendorsed, firstReply, oneEndorsement, twoEndorsements] })
        )
    );
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);

    const solutions = within(
      await screen.findByRole("region", { name: "Suggested solutions" })
    ).getAllByRole("listitem");
    const topLevel = solutions.filter((item) => item.classList.contains("reply"));
    expect(
      topLevel.map(
        (item) => within(item).getAllByText(/./, { selector: ".ticket-text" })[0]!.textContent
      )
    ).toEqual(["Reinstall driver", "Update firmware", "Restart the spooler"]);
    expect(within(topLevel[0]!).getByText("Endorsed by IT")).toBeInTheDocument();
    expect(within(topLevel[0]!).getByText(/Endorsed by Technician 2/)).toBeInTheDocument();
    expect(within(topLevel[0]!).getByText("Notes for Reinstall driver")).toBeInTheDocument();
    expect(within(topLevel[2]!).queryByText("Endorsed by IT")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Discussion" })).getByText(firstReply.body)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Endorse" })).not.toBeInTheDocument();
  });

  it("sorts solutions stably by endorsement count", () => {
    const first = solution("1", "First", 0);
    const second = solution("2", "Second", 1);
    const third = solution("3", "Third", 1);

    expect(sortSolutions([first, firstReply, second, third]).map((reply) => reply.id)).toEqual([
      "2",
      "3",
      "1"
    ]);
  });

  it("shows an accessible error and retries on request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(jsonResponse({ replies: [firstReply] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load the replies. Please try again."
    );
    expect(screen.queryByRole("button", { name: "Post reply" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(firstReply.body)).toBeInTheDocument();
  });

  it("rejects a malformed reply list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ replies: [{ id: 1 }] })));
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the replies.");
  });

  it("posts a trimmed reply, appends it, and clears the form", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ replies: [firstReply] }))
      .mockResolvedValueOnce(jsonResponse(secondReply, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);
    await screen.findByText(firstReply.body);

    writeReply(`  ${secondReply.body}  `);

    expect(await screen.findByText("Your reply has been posted.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(repliesUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: secondReply.body, kind: "COMMENT" })
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(secondReply.body)).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toHaveValue("");
  });

  it("posts a suggested solution into the solutions section", async () => {
    const posted = solution("a0000000-0000-4000-8000-000000000009", "Reinstall driver", 0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ replies: [] }))
      .mockResolvedValueOnce(jsonResponse(posted, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);
    await screen.findByText("No suggested solutions yet.");

    writeReply("Reinstall driver", "Suggest a solution");

    expect(await screen.findByText("Your reply has been posted.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(repliesUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Reinstall driver", kind: "SOLUTION" })
    });
    expect(
      within(screen.getByRole("region", { name: "Suggested solutions" })).getByText(
        "Reinstall driver"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
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
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);
    await screen.findByText("No comments yet.");

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
    render(<TicketReplies ticketId={ticketId} visibility="PUBLIC" />);
    await screen.findByText("No comments yet.");

    writeReply(secondReply.body);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't post your reply. Please try again."
    );
    expect(screen.getByLabelText("Your reply")).toHaveValue(secondReply.body);
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });
});
