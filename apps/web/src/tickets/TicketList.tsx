import { useEffect, useState } from "react";

import { listTickets, type Ticket } from "./ticket-api.js";

type LoadState = { type: "loading" } | { type: "loaded"; tickets: Ticket[] } | { type: "error" };

const statusLabels: Record<string, string> = {
  OPEN: "Open"
};

const createdAtFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime()) ? createdAt : createdAtFormat.format(date);
}

export function TicketList() {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    listTickets().then(
      (tickets) => {
        if (!ignore) {
          setLoad({ type: "loaded", tickets });
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
  }, [attempt]);

  function retry() {
    setLoad({ type: "loading" });
    setAttempt((current) => current + 1);
  }

  if (load.type === "loading") {
    return (
      <p className="list-message" role="status">
        Loading tickets…
      </p>
    );
  }

  if (load.type === "error") {
    return (
      <div className="error-message" role="alert">
        <p>We couldn&apos;t load the tickets. Please try again.</p>
        <button className="submit-button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  if (load.tickets.length === 0) {
    return <p className="list-message">No tickets have been submitted yet.</p>;
  }

  return (
    <ul className="ticket-list" aria-label="Submitted tickets">
      {load.tickets.map((ticket) => (
        <li key={ticket.id}>
          <article className="ticket-card" aria-labelledby={`ticket-${ticket.id}-title`}>
            <header className="ticket-card-header">
              <h2 id={`ticket-${ticket.id}-title`}>{ticket.title}</h2>
              <span className="status-badge">{statusLabels[ticket.status] ?? ticket.status}</span>
            </header>

            <p className="ticket-meta">
              Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
              <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time>
            </p>

            <p className="ticket-text">{ticket.description}</p>

            <details>
              <summary>Setup and additional information</summary>
              <dl>
                <dt>Setup</dt>
                <dd className="ticket-text">{ticket.setup}</dd>
                {ticket.additionalInformation ? (
                  <>
                    <dt>Additional information</dt>
                    <dd className="ticket-text">{ticket.additionalInformation}</dd>
                  </>
                ) : null}
              </dl>
            </details>
          </article>
        </li>
      ))}
    </ul>
  );
}
