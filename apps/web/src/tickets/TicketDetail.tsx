import { useEffect, useState } from "react";

import { getTicket, type Ticket } from "./ticket-api.js";
import { formatCreatedAt, formatStatus } from "./ticket-format.js";
import { TicketReplies } from "./TicketReplies.js";

type LoadState =
  | { type: "loading" }
  | { type: "loaded"; ticket: Ticket }
  | { type: "not-found" }
  | { type: "error" };

interface TicketDetailProps {
  ticketId: string;
}

export function TicketDetail({ ticketId }: TicketDetailProps) {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);

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

  return (
    <>
      <article className="ticket-card ticket-detail" aria-labelledby="page-title">
        <header className="ticket-card-header">
          <h1 id="page-title">{ticket.title}</h1>
          <span className="status-badge">{formatStatus(ticket.status)}</span>
        </header>

        <p className="ticket-meta">
          Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
          <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time>
        </p>

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
      </article>

      <TicketReplies ticketId={ticket.id} />
    </>
  );
}
