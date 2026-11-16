import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SolutionEndorsement } from "./SolutionEndorsement.js";
import type { Reply, Ticket, TicketStatus } from "./ticket-api.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";
const replyId = "0b9d7c58-0a55-4d0c-8a44-0d3f5f3f9a01";
const endorsementUrl = `/api/tickets/${ticketId}/replies/${replyId}/endorsement`;

const solution: Reply = {
  id: replyId,
  kind: "SOLUTION",
  body: "Reinstall the driver.",
  createdAt: "2026-10-28T18:30:00.000Z",
  endorsements: [],
  upvotes: 0,
  downvotes: 0,
  userVote: null
};

const ownEndorsement = {
  id: "a1b2c3d4-0000-4000-8000-000000000001",
  technicianName: "Terry Technician",
  notes: "Use v4.2.",
  createdAt: "2026-10-28T19:00:00.000Z",
  updatedAt: "2026-10-28T19:00:00.000Z",
  isOwn: true
};

const otherEndorsement = {
  ...ownEndorsement,
  id: "a1b2c3d4-0000-4000-8000-000000000002",
  technicianName: "Pat Other",
  notes: null,
  isOwn: false
};

function ticket(status: TicketStatus): Ticket {
  return {
    id: ticketId,
    title: "Printer offline",
    description: "Description",
    setup: "Setup",
    additionalInformation: null,
    status,
    priority: "MEDIUM",
    visibility: "PUBLIC",
    canReply: true,
    createdByName: null,
    createdAt: "2026-10-28T18:00:00.000Z",
    updatedAt: "2026-10-28T20:00:00.000Z"
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function renderEndorsement({
  reply = solution,
  status = "IN_PROGRESS" as TicketStatus,
  isTechnician = true
} = {}) {
  const onReplyUpdated = vi.fn();
  const onTicketUpdated = vi.fn();
  render(
    <SolutionEndorsement
      ticketId={ticketId}
      ticketStatus={status}
      reply={reply}
      isTechnician={isTechnician}
      onReplyUpdated={onReplyUpdated}
      onTicketUpdated={onTicketUpdated}
    />
  );

  return { onReplyUpdated, onTicketUpdated };
}

describe("SolutionEndorsement", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows endorsements without controls to non-technicians", () => {
    renderEndorsement({
      reply: { ...solution, endorsements: [{ ...ownEndorsement, isOwn: false }] },
      isTechnician: false
    });

    expect(screen.getByText(/Endorsed by Terry Technician/)).toBeInTheDocument();
    expect(screen.getByText("Use v4.2.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("endorses with notes and resolves the ticket when requested", async () => {
    const endorsed = { ...solution, endorsements: [ownEndorsement] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ reply: endorsed, ticket: ticket("RESOLVED") }));
    vi.stubGlobal("fetch", fetchMock);
    const { onReplyUpdated, onTicketUpdated } = renderEndorsement();

    fireEvent.click(screen.getByRole("button", { name: "Endorse" }));
    fireEvent.change(screen.getByLabelText("Notes for this endorsement"), {
      target: { value: "  Use v4.2.  " }
    });
    fireEvent.click(screen.getByLabelText("Also mark this ticket resolved"));
    fireEvent.click(screen.getByRole("button", { name: "Endorse solution" }));

    expect(
      await screen.findByText("Your endorsement has been saved and the ticket is now resolved.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(endorsementUrl, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: "Use v4.2.", markResolved: true })
    });
    expect(onReplyUpdated).toHaveBeenCalledWith(endorsed);
    expect(onTicketUpdated).toHaveBeenCalledWith(ticket("RESOLVED"));
  });

  it.each(["OPEN", "UNDER_REVIEW", "RESOLVED"] as const)(
    "does not offer to resolve a %s ticket",
    (status) => {
      renderEndorsement({ status });

      fireEvent.click(screen.getByRole("button", { name: "Endorse" }));

      expect(screen.queryByLabelText("Also mark this ticket resolved")).not.toBeInTheDocument();
    }
  );

  it("disables the form while the endorsement is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveRequest = resolve;
          })
      )
    );
    const { onTicketUpdated } = renderEndorsement();

    fireEvent.click(screen.getByRole("button", { name: "Endorse" }));
    fireEvent.click(screen.getByRole("button", { name: "Endorse solution" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    resolveRequest?.(
      jsonResponse({
        reply: { ...solution, endorsements: [ownEndorsement] },
        ticket: ticket("IN_PROGRESS")
      })
    );
    expect(await screen.findByText("Your endorsement has been saved.")).toBeInTheDocument();
    expect(onTicketUpdated).not.toHaveBeenCalled();
  });

  it("keeps the draft and explains a rejected status transition", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "INVALID_STATUS_TRANSITION", message: "Only in progress" } },
            400
          )
        )
    );
    const { onReplyUpdated } = renderEndorsement();

    fireEvent.click(screen.getByRole("button", { name: "Endorse" }));
    fireEvent.change(screen.getByLabelText("Notes for this endorsement"), {
      target: { value: "Draft" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Endorse solution" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The ticket can no longer be marked resolved from here."
    );
    expect(screen.getByLabelText("Notes for this endorsement")).toHaveValue("Draft");
    expect(onReplyUpdated).not.toHaveBeenCalled();
  });

  it("edits the technician's own notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          reply: { ...solution, endorsements: [{ ...ownEndorsement, notes: "Use v4.3." }] },
          ticket: ticket("IN_PROGRESS")
        })
      )
    );
    renderEndorsement({ reply: { ...solution, endorsements: [ownEndorsement, otherEndorsement] } });

    expect(screen.queryByRole("button", { name: "Endorse" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit notes" }));
    expect(screen.getByLabelText("Notes for this endorsement")).toHaveValue("Use v4.2.");
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));

    expect(await screen.findByText("Your endorsement has been saved.")).toBeInTheDocument();
  });

  it("withdraws only after confirmation and keeps other endorsements", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const reply = { ...solution, endorsements: [ownEndorsement, otherEndorsement] };
    const { onReplyUpdated } = renderEndorsement({ reply });

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw" }));

    expect(await screen.findByText("Your endorsement has been withdrawn.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(endorsementUrl, { method: "DELETE" });
    expect(onReplyUpdated).toHaveBeenCalledWith({ ...reply, endorsements: [otherEndorsement] });
  });

  it("can cancel a withdrawal and reports a failed one", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { code: "NOT_FOUND", message: "Gone" } }, 404))
    );
    renderEndorsement({ reply: { ...solution, endorsements: [ownEndorsement] } });

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep endorsement" }));
    expect(screen.getByRole("button", { name: "Edit notes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This solution or endorsement no longer exists."
      )
    );
  });

  it("closes the form on cancel", () => {
    renderEndorsement();

    fireEvent.click(screen.getByRole("button", { name: "Endorse" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Notes for this endorsement")).not.toBeInTheDocument();
  });
});
