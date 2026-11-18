import { useEffect, useState, type FormEvent } from "react";

import type { AuthenticatedUser } from "../auth/auth-api.js";
import { VoteControls } from "./VoteControls.js";
import {
  listTickets,
  setTicketVote,
  ticketPath,
  ticketSearchMaxLength,
  type ListedTicket,
  type TicketSort
} from "./ticket-api.js";
import {
  formatCreatedAt,
  formatReplyStatus,
  formatStatus,
  formatVisibility
} from "./ticket-format.js";

type LoadState =
  | { type: "loading" }
  | { type: "loaded"; tickets: ListedTicket[]; viewerId: string | null; query: string }
  | { type: "error" };

const searchDebounceMilliseconds = 300;

const searchParameter = "q";

function readSearchFromLocation(): string {
  const query = new URLSearchParams(window.location.search).get(searchParameter) ?? "";
  return query.trim().slice(0, ticketSearchMaxLength);
}

/** Keeps the applied search in the page URL so it survives a reload and can be shared. */
function writeSearchToLocation(query: string) {
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set(searchParameter, query);
  } else {
    url.searchParams.delete(searchParameter);
  }
  window.history.replaceState(window.history.state, "", url);
}

function formatMatchCount(count: number, query: string): string {
  if (count === 0) {
    return `No tickets match “${query}”.`;
  }
  return `${count} ${count === 1 ? "ticket matches" : "tickets match"} “${query}”.`;
}

export function TicketList({ currentUser = null }: { currentUser?: AuthenticatedUser | null }) {
  const viewerId = currentUser?.id ?? null;
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<TicketSort>("votes");
  const [query, setQuery] = useState(readSearchFromLocation);
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    let ignore = false;

    listTickets(sort, { query }).then(
      (tickets) => {
        if (!ignore) {
          setLoad({ type: "loaded", tickets, viewerId, query });
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
  }, [attempt, sort, viewerId, query]);

  function retry() {
    setLoad({ type: "loading" });
    setAttempt((current) => current + 1);
  }

  function changeSort(nextSort: TicketSort) {
    setLoad({ type: "loading" });
    setSort(nextSort);
  }

  const draftQuery = draft.trim();

  // Search as the visitor types, once they pause.
  useEffect(() => {
    if (draftQuery === query) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeSearchToLocation(draftQuery);
      // Replace an error at once; tickets on screen stay until the new results arrive.
      setLoad((current) => (current.type === "error" ? { type: "loading" } : current));
      setQuery(draftQuery);
    }, searchDebounceMilliseconds);

    return () => window.clearTimeout(timer);
  }, [draftQuery, query]);

  /**
   * Applies a search at once instead of waiting for a pause in typing. Repeating the current search
   * after a failure tries it again.
   */
  function applySearch(nextQuery: string) {
    setDraft(nextQuery);
    writeSearchToLocation(nextQuery);
    if (nextQuery === query) {
      if (load.type === "error") {
        retry();
      }
      return;
    }
    if (load.type === "error") {
      setLoad({ type: "loading" });
    }
    setQuery(nextQuery);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applySearch(draftQuery);
  }

  // What the tickets on screen were found with; it trails `query` while a search is pending.
  const shownQuery = load.type === "loaded" ? load.query : query;
  const isSearchPending =
    load.type === "loaded" && (load.query !== query || load.viewerId !== viewerId);

  return (
    <>
      <form className="ticket-search" role="search" onSubmit={submitSearch}>
        <label className="visually-hidden" htmlFor="ticket-search">
          Search tickets
        </label>
        <input
          id="ticket-search"
          type="search"
          maxLength={ticketSearchMaxLength}
          value={draft}
          placeholder="Search tickets"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>

      {query ? (
        <div className="ticket-search-summary">
          <p role="status">
            {load.type === "loaded" && !isSearchPending
              ? formatMatchCount(load.tickets.length, query)
              : load.type === "error"
                ? ""
                : "Searching tickets…"}
          </p>
          <button className="text-button" type="button" onClick={() => applySearch("")}>
            Clear search
          </button>
        </div>
      ) : null}

      <div className="ticket-sort-control">
        <label htmlFor="ticket-sort">Sort tickets</label>
        <select
          id="ticket-sort"
          value={sort}
          onChange={(event) => changeSort(event.target.value as TicketSort)}
        >
          <option value="votes">Most Votes</option>
          <option value="newest">Newest First</option>
          <option value="priority">Priority: High to Low</option>
        </select>
      </div>
      {load.type === "loading" || (load.type === "loaded" && load.viewerId !== viewerId) ? (
        query ? null : (
          <p className="list-message" role="status">
            Loading tickets…
          </p>
        )
      ) : load.type === "error" ? (
        <div className="error-message" role="alert">
          <p>We couldn&apos;t load the tickets. Please try again.</p>
          <button className="submit-button" type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : load.tickets.length === 0 ? (
        shownQuery ? (
          <p className="list-message">
            Try different or fewer words, or <a href="/new">create a ticket</a> for your issue.
          </p>
        ) : (
          <p className="list-message">No tickets have been submitted yet.</p>
        )
      ) : (
        <ul
          className="ticket-list"
          aria-label={shownQuery ? "Matching tickets" : "Submitted tickets"}
          aria-busy={isSearchPending}
        >
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
                    <span className="reply-status-badge">
                      {formatReplyStatus(ticket.replyStatus ?? "OPEN")}
                    </span>
                  </span>
                </header>

                <p className="ticket-meta">
                  Reference <code>{ticket.id.slice(0, 8)}</code> · Submitted{" "}
                  <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time> ·
                  Created by {ticket.createdByName ?? "Anonymous"}
                </p>

                <p className="ticket-text ticket-excerpt">{ticket.description}</p>
                <VoteControls
                  key={`${ticket.id}:${viewerId ?? "anonymous"}`}
                  subject="ticket"
                  initialState={{
                    ...ticket.votes,
                    userVote: currentUser ? ticket.votes.userVote : null
                  }}
                  canVote={currentUser !== null}
                  saveVote={(value) => setTicketVote(ticket.id, value)}
                />
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
