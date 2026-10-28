import { useEffect, useState } from "react";

import { listTickets, ticketPath, type Ticket, type TicketSort } from "./ticket-api.js";
import { formatCreatedAt, formatStatus, formatVisibility } from "./ticket-format.js";

type LoadState = { type: "loading" } | { type: "loaded"; tickets: Ticket[] } | { type: "error" };

export function TicketList() {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<TicketSort>("newest");

  useEffect(() => {
    let ignore = false;

    listTickets(sort).then(
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
  }, [attempt, sort]);

  function retry() {
    setLoad({ type: "loading" });
    setAttempt((current) => current + 1);
  }

  function changeSort(nextSort: TicketSort) {
    setLoad({ type: "loading" });
    setSort(nextSort);
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

  return (
    <>
      <div className="ticket-sort-control">
        <label htmlFor="ticket-sort">Sort tickets</label>
        <select
          id="ticket-sort"
          value={sort}
          onChange={(event) => changeSort(event.target.value as TicketSort)}
        >
          <option value="newest">Newest First</option>
          <option value="priority">Priority: High to Low</option>
        </select>
      </div>
      {load.tickets.length === 0 ? (
        <p className="list-message">No tickets have been submitted yet.</p>
      ) : (
        <ul className="ticket-list" aria-label="Submitted tickets">
          {load.tickets.map((ticket) => (
            <li key={ticket.id}>
              <article className="ticket-card" aria-labelledby={`ticket-${ticket.id}-title`}>
                <header className="ticket-card-header">
                  <h2 id={`ticket-${ticket.id}-title`}>
                    <a href={ticketPath(ticket.id)}>{ticket.title}</a>
                  </h2>
                  <span className="ticket-badges">
                    <span className="status-badge">{formatStatus(ticket.status)}</span>
                    <span className="visibility-badge">{formatVisibility(ticket.visibility)}</span>
                    <span className="priority-badge">
                      {ticket.priority[0] + ticket.priority.slice(1).toLowerCase()}
                    </span>
                  </span>
                </header>

                <p className="ticket-meta">
                  Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
                  <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time> ·
                  Created by {ticket.createdByName ?? "Anonymous"}
                </p>

                <p className="ticket-text ticket-excerpt">{ticket.description}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
