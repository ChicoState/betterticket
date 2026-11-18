import { useEffect, useState } from "react";

import type { AuthenticatedUser } from "../auth/auth-api.js";
import { formatCreatedAt, formatStatus } from "./ticket-format.js";
import { listTicketHistory, ticketPath, type Ticket } from "./ticket-api.js";

type LoadState = { type: "loading" } | { type: "loaded"; tickets: Ticket[] } | { type: "error" };

export function TicketHistory({ currentUser }: { currentUser: AuthenticatedUser | null }) {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let ignore = false;
    setLoad({ type: "loading" });
    listTicketHistory().then(
      (tickets) => {
        if (!ignore) setLoad({ type: "loaded", tickets });
      },
      () => {
        if (!ignore) setLoad({ type: "error" });
      }
    );

    return () => {
      ignore = true;
    };
  }, [attempt, currentUser]);

  if (!currentUser) {
    return (
      <div className="list-message" role="status">
        <p>Sign in to view your ticket history.</p>
        <a className="primary-link" href="/">
          Sign in
        </a>
      </div>
    );
  }

  if (load.type === "loading") {
    return (
      <p className="list-message" role="status">
        Loading your ticket history…
      </p>
    );
  }

  if (load.type === "error") {
    return (
      <div className="error-message" role="alert">
        <p>We couldn&apos;t load your ticket history. Please try again.</p>
        <button
          className="submit-button"
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  if (load.tickets.length === 0) {
    return <p className="list-message">You haven&apos;t submitted any tickets yet.</p>;
  }

  return (
    <ul className="ticket-list" aria-label="Your ticket history">
      {load.tickets.map((ticket) => (
        <li key={ticket.id}>
          <article className="ticket-card" aria-labelledby={`history-${ticket.id}-title`}>
            <header className="ticket-card-header">
              <h2 id={`history-${ticket.id}-title`}>
                <a href={ticketPath(ticket.id)}>{ticket.title}</a>
              </h2>
              <span className="ticket-badges">
                <span className="status-badge">{formatStatus(ticket.status)}</span>
              </span>
            </header>
            <p className="ticket-meta">
              Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
              <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time>
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
