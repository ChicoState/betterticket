import { useEffect, useState } from "react";

import { listTickets, ticketPath, ticketSearchMaxLength, type Ticket } from "./ticket-api.js";
import { formatStatus } from "./ticket-format.js";

const debounceMilliseconds = 300;
const resultLimit = 5;
const minimumTitleLength = 3;

type LookupMode = "search" | "similar";

interface Lookup {
  mode: LookupMode;
  query: string;
}

type LookupResult = Lookup & ({ type: "loaded"; tickets: Ticket[] } | { type: "error" });

const copy = {
  search: {
    heading: "Search results",
    loading: "Searching tickets…",
    empty: "No tickets match your search.",
    count: (count: number) => `${count} ${count === 1 ? "ticket matches" : "tickets match"}`
  },
  similar: {
    heading: "Similar tickets",
    loading: "Looking for similar tickets…",
    empty: "No similar tickets found.",
    count: (count: number) => `${count} similar ${count === 1 ? "ticket" : "tickets"}`
  }
};

function searchResultsPath(query: string): string {
  return `/tickets?q=${encodeURIComponent(query)}`;
}

interface TicketSuggestionsProps {
  /** The title being typed in the new-ticket form. */
  title: string;
}

/**
 * Sidebar for the new-ticket form: shows search results when the visitor searches, and otherwise
 * tickets similar to the title they are typing.
 */
export function TicketSuggestions({ title }: TicketSuggestionsProps) {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  const searchText = search.trim();
  const titleText = title.trim();
  const mode: LookupMode | null = searchText
    ? "search"
    : titleText.length >= minimumTitleLength
      ? "similar"
      : null;
  const query = mode === "search" ? searchText : titleText;

  useEffect(() => {
    if (!mode) {
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(() => {
      listTickets("votes", {
        query,
        match: mode === "search" ? "all" : "any",
        limit: resultLimit
      }).then(
        (tickets) => {
          if (!ignore) {
            setResult({ mode, query, type: "loaded", tickets });
          }
        },
        () => {
          if (!ignore) {
            setResult({ mode, query, type: "error" });
          }
        }
      );
    }, debounceMilliseconds);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [mode, query]);

  // Keep the previous results on screen while a newer lookup of the same kind is pending.
  const shown = mode && result?.mode === mode ? result : null;
  const isPending = mode !== null && (shown === null || shown.query !== query);
  const text = mode ? copy[mode] : null;

  return (
    <aside className="ticket-suggestions" aria-labelledby="ticket-suggestions-title">
      <h2 id="ticket-suggestions-title">Already solved?</h2>

      <form
        className="field"
        role="search"
        aria-label="Existing tickets"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="visually-hidden" htmlFor="suggestion-search">
          Search existing tickets
        </label>
        <input
          id="suggestion-search"
          type="search"
          placeholder="Search tickets"
          maxLength={ticketSearchMaxLength}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </form>

      {text ? <h3>{text.heading}</h3> : null}

      <p className="field-hint" role="status">
        {!text
          ? ""
          : isPending
            ? text.loading
            : shown?.type === "error"
              ? "We couldn't check for existing tickets. You can still create your ticket."
              : shown?.tickets.length === 0
                ? text.empty
                : text.count(shown?.tickets.length ?? 0)}
      </p>

      {shown?.type === "loaded" && shown.tickets.length > 0 ? (
        <ul className="suggestion-list" aria-label={text?.heading} aria-busy={isPending}>
          {shown.tickets.map((ticket) => (
            <li key={ticket.id}>
              <a href={ticketPath(ticket.id)} target="_blank" rel="noreferrer">
                {ticket.title} <span className="visually-hidden">(opens in a new tab)</span>
              </a>
              <span className="status-badge">{formatStatus(ticket.status)}</span>
              <p className="ticket-excerpt">{ticket.description}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === "search" && shown?.type === "loaded" && shown.tickets.length > 0 ? (
        <a
          className="suggestion-more"
          href={searchResultsPath(shown.query)}
          target="_blank"
          rel="noreferrer"
        >
          See all results <span className="visually-hidden">(opens in a new tab)</span>
        </a>
      ) : null}
    </aside>
  );
}
