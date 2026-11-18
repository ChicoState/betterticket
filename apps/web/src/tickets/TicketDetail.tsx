import { TicketVote } from "./TicketVote.js";
import { useEffect, useState } from "react";

import type { AuthenticatedUser } from "../auth/auth-api.js";
import {
  getTicket,
  ticketPriorities,
  TicketStatusUpdateError,
  updateTicketPriority,
  updateTicketReplyStatus,
  updateTicketStatus,
  type Ticket,
  type TicketPriority,
  type TicketReplyStatus,
  type TicketStatus
} from "./ticket-api.js";
import {
  formatCreatedAt,
  formatReplyStatus,
  formatStatus,
  formatVisibility,
  getNextProgressStatus,
  getProgressStageState,
  ticketProgress
} from "./ticket-format.js";
import { TicketReplies } from "./TicketReplies.js";

type LoadState =
  | { type: "loading" }
  | { type: "loaded"; ticket: Ticket }
  | { type: "not-found" }
  | { type: "error" };

type StatusUpdateState =
  | { type: "idle" }
  | { type: "updating"; status: TicketStatus }
  | { type: "success"; status: TicketStatus }
  | { type: "error"; message: string };

type PriorityUpdateState =
  | { type: "idle" }
  | { type: "saving" }
  | { type: "success"; priority: TicketPriority }
  | { type: "error" };

interface TicketDetailProps {
  ticketId: string;
  currentUser?: AuthenticatedUser | null;
}

function formatPriority(priority: TicketPriority): string {
  return priority[0] + priority.slice(1).toLowerCase();
}

interface TicketPriorityEditorProps {
  ticket: Ticket;
  onTicketUpdated: (ticket: Ticket) => void;
}

function TicketPriorityEditor({ ticket, onTicketUpdated }: TicketPriorityEditorProps) {
  const [selectedPriority, setSelectedPriority] = useState(ticket.priority);
  const [update, setUpdate] = useState<PriorityUpdateState>({ type: "idle" });
  const inputId = `ticket-priority-${ticket.id}`;
  const messageId = `${inputId}-message`;
  const saving = update.type === "saving";
  const unchanged = selectedPriority === ticket.priority;

  useEffect(() => {
    setSelectedPriority(ticket.priority);
  }, [ticket.id, ticket.priority]);

  async function savePriority(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || unchanged) {
      return;
    }

    setUpdate({ type: "saving" });
    try {
      const updatedTicket = await updateTicketPriority(ticket.id, selectedPriority);
      setSelectedPriority(updatedTicket.priority);
      setUpdate({ type: "success", priority: updatedTicket.priority });
      onTicketUpdated(updatedTicket);
    } catch {
      setSelectedPriority(ticket.priority);
      setUpdate({ type: "error" });
    }
  }

  return (
    <form className="priority-editor" onSubmit={(event) => void savePriority(event)}>
      <label htmlFor={inputId}>Ticket priority</label>
      <div className="priority-editor-controls">
        <select
          id={inputId}
          aria-describedby={messageId}
          disabled={saving}
          value={selectedPriority}
          onChange={(event) => {
            setSelectedPriority(event.target.value as TicketPriority);
            setUpdate({ type: "idle" });
          }}
        >
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {formatPriority(priority)}
            </option>
          ))}
        </select>
        <button className="submit-button" type="submit" disabled={saving || unchanged}>
          {saving ? "Saving priority…" : "Save priority"}
        </button>
      </div>
      <div id={messageId} className="submission-message" aria-live="polite">
        {update.type === "success" ? (
          <p className="success-message" role="status">
            Ticket priority updated to {formatPriority(update.priority)}.
          </p>
        ) : null}
      </div>
      {update.type === "error" ? (
        <p className="error-message" role="alert">
          We couldn&apos;t update the ticket priority. Please try again.
        </p>
      ) : null}
    </form>
  );
}

export function TicketDetail({ ticketId, currentUser = null }: TicketDetailProps) {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [replyStatusUpdate, setReplyStatusUpdate] = useState<"idle" | "saving" | "error">("idle");
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdateState>({ type: "idle" });

  useEffect(() => {
    let ignore = false;

    getTicket(ticketId).then(
      (ticket) => {
        if (!ignore) {
          setLoad(ticket ? { type: "loaded", ticket } : { type: "not-found" });
        }
      },
      () => {
        if (!ignore) {
          setLoad({ type: "error" });
        }
      }
    );

    return () => {
      ignore = true;
    };
  }, [ticketId, attempt]);

  function retry() {
    setLoad({ type: "loading" });
    setAttempt((current) => current + 1);
  }

  async function changeReplyStatus(replyStatus: TicketReplyStatus) {
    if (load.type !== "loaded") {
      return;
    }
    setReplyStatusUpdate("saving");
    try {
      const ticket = await updateTicketReplyStatus(load.ticket.id, replyStatus);
      setLoad({ type: "loaded", ticket });
      setReplyStatusUpdate("idle");
    } catch {
      setReplyStatusUpdate("error");
    }
  }

  async function updateStatus(status: TicketStatus) {
    setStatusUpdate({ type: "updating", status });

    try {
      const updatedTicket = await updateTicketStatus(ticketId, status);
      setLoad({ type: "loaded", ticket: updatedTicket });
      setStatusUpdate({ type: "success", status: updatedTicket.status });
    } catch (error) {
      const message =
        error instanceof TicketStatusUpdateError && error.code === "INVALID_STATUS_TRANSITION"
          ? "That status update is no longer valid. Refresh the ticket and try again."
          : error instanceof TicketStatusUpdateError && error.code === "FORBIDDEN"
            ? "You need technician access to update this ticket."
            : "We couldn't update the ticket status. Please try again.";
      setStatusUpdate({ type: "error", message });
    }
  }

  if (load.type === "loading") {
    return (
      <p className="list-message" role="status">
        Loading ticket…
      </p>
    );
  }

  if (load.type === "error") {
    return (
      <div className="error-message" role="alert">
        <p>We couldn&apos;t load this ticket. Please try again.</p>
        <button className="submit-button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  if (load.type === "not-found") {
    return (
      <section className="ticket-card ticket-detail" aria-labelledby="page-title">
        <h1 id="page-title">Ticket not found</h1>
        <p className="ticket-text">
          This ticket doesn&apos;t exist. Check the link, or go back to the list of submitted
          tickets.
        </p>
      </section>
    );
  }

  const { ticket } = load;
  const nextStatus = getNextProgressStatus(ticket.status);
  return (
    <>
      <article className="ticket-card ticket-detail" aria-labelledby="page-title">
        <header className="ticket-card-header">
          <h1 id="page-title">{ticket.title}</h1>
          <div className="ticket-detail-header-actions">
            <span className="status-badge">{formatStatus(ticket.status)}</span>
            <span className="reply-status-badge">
              {formatReplyStatus(ticket.replyStatus ?? "OPEN")}
            </span>
            {ticket.canManageReplyStatus ? (
              <button
                className="submit-button"
                type="button"
                disabled={replyStatusUpdate === "saving"}
                onClick={() =>
                  void changeReplyStatus(ticket.replyStatus === "OPEN" ? "CLOSED" : "OPEN")
                }
              >
                {replyStatusUpdate === "saving"
                  ? "Saving…"
                  : ticket.replyStatus === "OPEN"
                    ? "Close ticket"
                    : "Reopen ticket"}
              </button>
            ) : null}
          </div>
          <div className="ticket-priority-area">
            <span className="ticket-badges">
              <span className="visibility-badge">{formatVisibility(ticket.visibility)}</span>
              <span className="priority-badge">{formatPriority(ticket.priority)}</span>
            </span>
            {currentUser?.role === "TECHNICIAN" ? (
              <TicketPriorityEditor
                ticket={ticket}
                onTicketUpdated={(updatedTicket) =>
                  setLoad({ type: "loaded", ticket: updatedTicket })
                }
              />
            ) : null}
          </div>
        </header>
        {replyStatusUpdate === "error" ? (
          <p className="error-message" role="alert">
            We couldn&apos;t update reply status. Please try again.
          </p>
        ) : null}
        <p className="ticket-meta">
          Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
          <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time> · Created by{" "}
          {ticket.createdByName ?? "Anonymous"} · <span>Last updated</span>{" "}
          <time dateTime={ticket.updatedAt}>{formatCreatedAt(ticket.updatedAt)}</time>
        </p>
        <section className="ticket-progress" aria-labelledby="ticket-progress-title">
          <div className="ticket-progress-heading">
            <h2 id="ticket-progress-title">Ticket progress</h2>
            {currentUser?.role === "TECHNICIAN" && nextStatus && nextStatus !== "COMPLETED" ? (
              <button
                className="status-update-button"
                disabled={statusUpdate.type === "updating"}
                onClick={() => updateStatus(nextStatus)}
                type="button"
              >
                {statusUpdate.type === "updating"
                  ? "Updating status…"
                  : `Move to ${formatStatus(nextStatus)}`}
              </button>
            ) : null}
          </div>
          <ol className="progress-timeline" aria-label="Ticket progress">
            {ticketProgress.map((stage) => {
              const stageState = getProgressStageState(ticket.status, stage);
              return (
                <li
                  key={stage}
                  className={`progress-stage progress-stage-${stageState}`}
                  aria-current={stageState === "current" ? "step" : undefined}
                >
                  <span className="progress-stage-marker" aria-hidden="true">
                    {stageState === "complete" ? "✓" : ""}
                  </span>
                  <span className="progress-stage-label">{formatStatus(stage)}</span>
                  <span className="progress-stage-state">
                    {stageState === "complete"
                      ? "Complete"
                      : stageState === "current"
                        ? "Current stage"
                        : "Upcoming"}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="submission-message" aria-live="polite">
            {statusUpdate.type === "success" ? (
              <p className="success-message" role="status">
                Ticket status updated to {formatStatus(statusUpdate.status)}.
              </p>
            ) : null}
          </div>
          {statusUpdate.type === "error" ? (
            <p className="error-message" role="alert">
              {statusUpdate.message}
            </p>
          ) : null}
        </section>
        <dl>
          <dt>What is happening</dt>
          <dd className="ticket-text">{ticket.description}</dd>
          <dt>Setup</dt>
          <dd className="ticket-text">{ticket.setup}</dd>
          {ticket.additionalInformation ? (
            <>
              <dt>Additional information</dt>
              <dd className="ticket-text">{ticket.additionalInformation}</dd>
            </>
          ) : null}
        </dl>
        <TicketVote
          key={`${ticket.id}:${currentUser?.id ?? "anonymous"}`}
          ticketId={ticket.id}
          currentUser={currentUser}
        />
      </article>
      <TicketReplies
        key={`${ticket.id}:${currentUser?.id ?? "anonymous"}`}
        ticketId={ticket.id}
        currentUser={currentUser}
        replyStatus={ticket.replyStatus ?? "OPEN"}
        onTicketClosed={retry}
        visibility={ticket.visibility}
        ticketStatus={ticket.status}
        isTechnician={currentUser?.role === "TECHNICIAN"}
        onTicketUpdated={(updatedTicket) => setLoad({ type: "loaded", ticket: updatedTicket })}
      />
    </>
  );
}
