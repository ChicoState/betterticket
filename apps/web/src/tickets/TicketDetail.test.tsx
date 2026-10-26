import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketDetail } from "./TicketDetail.js";
import type { AuthenticatedUser } from "../auth/auth-api.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";

const ticket = {
  id: ticketId,
  title: "Laptop will not start",
  description: "The power light flashes once.",
  setup: "Framework Laptop 13, Fedora 42",
  additionalInformation: "Started after an update.",
  status: "OPEN",
  visibility: "PUBLIC",
  canReply: true,
  createdByName: "Uma User",
  createdAt: "2026-09-28T18:00:00.000Z",
  updatedAt: "2026-09-28T18:00:00.000Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function ticketFetch(ticketBody: unknown) {
  return vi.fn((url: string) =>
    Promise.resolve(jsonResponse(url.endsWith("/replies") ? { replies: [] } : ticketBody))
  );
}

const technician: AuthenticatedUser = {
  id: "technician-id",
  name: "Tara Technician",
  username: "tara",
  role: "TECHNICIAN"
};

describe("TicketDetail", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading status and then every ticket field", async () => {
    const fetchMock = ticketFetch(ticket);
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket…");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Laptop will not start" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/tickets/${ticketId}`);
    expect(screen.getByText("Open", { selector: ".status-badge" })).toBeInTheDocument();
    expect(screen.getByText("cc04d84c")).toBeInTheDocument();
    expect(screen.getByText("The power light flashes once.")).toBeInTheDocument();
    expect(screen.getByText("Framework Laptop 13, Fedora 42")).toBeInTheDocument();
    expect(screen.getByText("Started after an update.")).toBeInTheDocument();
    expect(screen.getByText(/Created by Uma User/)).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-09-28T18:00:00.000Z");
  });

  it("shows the ticket's replies and reply form below the ticket", async () => {
    const fetchMock = ticketFetch(ticket);
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} />);

    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Replies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post reply" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/tickets/${ticketId}/replies`);
  });

  it("omits additional information when none was submitted", async () => {
    vi.stubGlobal("fetch", ticketFetch({ ...ticket, additionalInformation: null }));
    render(<TicketDetail ticketId={ticketId} />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Additional information")).not.toBeInTheDocument();
  });

  it.each([
    ["OPEN", "Open"],
    ["UNDER_REVIEW", "Under review"],
    ["IN_PROGRESS", "In progress"],
    ["RESOLVED", "Resolved"],
    ["COMPLETED", "Completed"]
  ])("shows %s as the current stage in the progress timeline", async (status, label) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...ticket, status })));
    render(<TicketDetail ticketId={ticketId} />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Ticket progress" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(
      screen.getByText(label, { selector: ".progress-stage-current .progress-stage-label" })
    ).toBeInTheDocument();
  });

  it("shows the next status control only to technicians", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...ticket })));
    render(<TicketDetail ticketId={ticketId} currentUser={technician} />);

    expect(await screen.findByRole("button", { name: "Move to Under review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to Under review" })).toBeEnabled();
  });

  it("does not show status controls to regular users", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...ticket })));
    render(
      <TicketDetail
        ticketId={ticketId}
        currentUser={{ ...technician, role: "USER", name: "Uma User", username: "uma" }}
      />
    );

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /Move to/ })).not.toBeInTheDocument();
  });

  it("does not show a status control after the ticket is completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ...ticket, status: "COMPLETED" }))
    );
    render(<TicketDetail ticketId={ticketId} currentUser={technician} />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /Move to/ })).not.toBeInTheDocument();
  });

  it("updates the timeline after a technician advances the ticket", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/replies")) {
        return Promise.resolve(jsonResponse({ replies: [] }));
      }
      if (init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ ...ticket, status: "UNDER_REVIEW" }));
      }
      return Promise.resolve(jsonResponse(ticket));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} currentUser={technician} />);

    fireEvent.click(await screen.findByRole("button", { name: "Move to Under review" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ticket status updated to Under review."
    );
    expect(screen.getByText("Under review", { selector: ".status-badge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to In progress" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "UNDER_REVIEW" })
    });
  });

  it("disables the status control while the update is pending", async () => {
    let resolveUpdate: (response: Response) => void = () => undefined;
    const update = new Promise<Response>((resolve) => {
      resolveUpdate = resolve;
    });
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/replies")) {
        return Promise.resolve(jsonResponse({ replies: [] }));
      }
      if (init?.method === "PATCH") {
        return update;
      }
      return Promise.resolve(jsonResponse(ticket));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} currentUser={technician} />);

    const button = await screen.findByRole("button", { name: "Move to Under review" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Updating status…" })).toBeDisabled();
    resolveUpdate(jsonResponse({ ...ticket, status: "UNDER_REVIEW" }));
    expect(await screen.findByText("Ticket status updated to Under review.")).toBeInTheDocument();
  });

  it("shows an accessible error when the status update is rejected", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/replies")) {
        return Promise.resolve(jsonResponse({ replies: [] }));
      }
      if (init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "INVALID_STATUS_TRANSITION",
                message: "The ticket status transition is invalid"
              }
            },
            400
          )
        );
      }
      return Promise.resolve(jsonResponse(ticket));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} currentUser={technician} />);

    fireEvent.click(await screen.findByRole("button", { name: "Move to Under review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That status update is no longer valid. Refresh the ticket and try again."
    );
    expect(screen.getByRole("button", { name: "Move to Under review" })).toBeEnabled();
  });

  it("shows the last updated timestamp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ...ticket, updatedAt: "2026-09-30T10:15:00.000Z" }))
    );
    render(<TicketDetail ticketId={ticketId} />);

    expect(await screen.findByText("Last updated")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-09-30T10:15:00.000Z"]')).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Post reply" })).not.toBeInTheDocument();
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
      .mockResolvedValueOnce(jsonResponse(ticket))
      .mockResolvedValueOnce(jsonResponse({ replies: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketDetail ticketId={ticketId} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load this ticket. Please try again."
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Laptop will not start"
    );
    expect(await screen.findByText("No replies yet.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
