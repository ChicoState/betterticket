import { useId, useState, type FormEvent } from "react";

import {
  EndorsementError,
  endorseReply,
  withdrawEndorsement,
  type Reply,
  type Ticket,
  type TicketStatus
} from "./ticket-api.js";
import { formatCreatedAt } from "./ticket-format.js";

const notesMaxLength = 2_000;

type Mode = { type: "idle" } | { type: "editing" } | { type: "confirming-withdraw" };

type RequestState =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

interface SolutionEndorsementProps {
  ticketId: string;
  ticketStatus: TicketStatus;
  reply: Reply;
  isTechnician: boolean;
  onReplyUpdated: (reply: Reply) => void;
  onTicketUpdated: (ticket: Ticket) => void;
}

export function SolutionEndorsement({
  ticketId,
  ticketStatus,
  reply,
  isTechnician,
  onReplyUpdated,
  onTicketUpdated
}: SolutionEndorsementProps) {
  const [mode, setMode] = useState<Mode>({ type: "idle" });
  const [request, setRequest] = useState<RequestState>({ type: "idle" });
  const idPrefix = useId();
  const ownEndorsement = reply.endorsements.find((endorsement) => endorsement.isOwn);
  const pending = request.type === "pending";

  async function handleEndorse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get("notes") ?? "").trim();
    const markResolved = formData.get("markResolved") === "on";
    setRequest({ type: "pending" });

    try {
      const result = await endorseReply(ticketId, reply.id, { notes, markResolved });
      onReplyUpdated(result.reply);
      if (result.ticket.status !== ticketStatus) {
        onTicketUpdated(result.ticket);
      }
      setMode({ type: "idle" });
      setRequest({
        type: "success",
        message:
          result.ticket.status === "RESOLVED" && ticketStatus !== "RESOLVED"
            ? "Your endorsement has been saved and the ticket is now resolved."
            : "Your endorsement has been saved."
      });
    } catch (error) {
      setRequest({ type: "error", message: endorsementErrorMessage(error) });
    }
  }

  async function handleWithdraw() {
    setRequest({ type: "pending" });

    try {
      await withdrawEndorsement(ticketId, reply.id);
      onReplyUpdated({
        ...reply,
        endorsements: reply.endorsements.filter((endorsement) => !endorsement.isOwn)
      });
      setMode({ type: "idle" });
      setRequest({ type: "success", message: "Your endorsement has been withdrawn." });
    } catch (error) {
      setRequest({ type: "error", message: endorsementErrorMessage(error) });
    }
  }

  return (
    <div className="endorsements">
      {reply.endorsements.length > 0 ? (
        <ul className="endorsement-list" aria-label="Technician endorsements">
          {reply.endorsements.map((endorsement) => (
            <li className="endorsement" key={endorsement.id}>
              <p className="ticket-meta">
                Endorsed by {endorsement.technicianName}{" "}
                <time dateTime={endorsement.updatedAt}>
                  {formatCreatedAt(endorsement.updatedAt)}
                </time>
              </p>
              {endorsement.notes ? <p className="ticket-text">{endorsement.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isTechnician ? (
        <div className="endorsement-controls">
          {mode.type === "editing" ? (
            <form className="endorsement-form" onSubmit={handleEndorse}>
              <fieldset disabled={pending}>
                <div className="field">
                  <label htmlFor={`${idPrefix}-notes`}>Notes for this endorsement</label>
                  <p className="field-hint" id={`${idPrefix}-notes-hint`}>
                    Optional. Shown with your name to everyone who can view this ticket.
                  </p>
                  <textarea
                    id={`${idPrefix}-notes`}
                    name="notes"
                    rows={3}
                    maxLength={notesMaxLength}
                    defaultValue={ownEndorsement?.notes ?? ""}
                    aria-describedby={`${idPrefix}-notes-hint`}
                  />
                </div>

                {ticketStatus === "IN_PROGRESS" ? (
                  <div className="checkbox-field">
                    <input id={`${idPrefix}-resolve`} name="markResolved" type="checkbox" />
                    <label htmlFor={`${idPrefix}-resolve`}>Also mark this ticket resolved</label>
                  </div>
                ) : null}

                <div className="endorsement-actions">
                  <button className="status-update-button" type="submit">
                    {pending ? "Saving…" : ownEndorsement ? "Save notes" : "Endorse solution"}
                  </button>
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => {
                      setMode({ type: "idle" });
                      setRequest({ type: "idle" });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>
          ) : mode.type === "confirming-withdraw" ? (
            <div className="endorsement-actions" role="group" aria-label="Withdraw endorsement">
              <p className="ticket-meta">Withdraw your endorsement of this solution?</p>
              <button
                className="status-update-button"
                type="button"
                disabled={pending}
                onClick={handleWithdraw}
              >
                {pending ? "Withdrawing…" : "Yes, withdraw"}
              </button>
              <button
                className="link-button"
                type="button"
                disabled={pending}
                onClick={() => {
                  setMode({ type: "idle" });
                  setRequest({ type: "idle" });
                }}
              >
                Keep endorsement
              </button>
            </div>
          ) : (
            <div className="endorsement-actions">
              <button
                className="status-update-button"
                type="button"
                onClick={() => {
                  setMode({ type: "editing" });
                  setRequest({ type: "idle" });
                }}
              >
                {ownEndorsement ? "Edit notes" : "Endorse"}
              </button>
              {ownEndorsement ? (
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setMode({ type: "confirming-withdraw" });
                    setRequest({ type: "idle" });
                  }}
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          )}

          <div className="submission-message" aria-live="polite">
            {request.type === "success" ? (
              <p className="success-message">{request.message}</p>
            ) : null}
          </div>
          {request.type === "error" ? (
            <p className="error-message" role="alert">
              {request.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function endorsementErrorMessage(error: unknown): string {
  if (error instanceof EndorsementError) {
    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "The ticket can no longer be marked resolved from here. Refresh the ticket and try again.";
    }
    if (error.code === "FORBIDDEN" || error.status === 401) {
      return "You need technician access to endorse solutions.";
    }
    if (error.status === 404) {
      return "This solution or endorsement no longer exists. Refresh the ticket and try again.";
    }
  }

  return "We couldn't save your endorsement. Please try again.";
}
