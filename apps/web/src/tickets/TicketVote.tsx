import { useEffect, useState } from "react";
import type { AuthenticatedUser } from "../auth/auth-api.js";
import { getTicketVote, setTicketVote, type VoteState } from "./ticket-api.js";
import { VoteControls } from "./VoteControls.js";

type LoadState =
  | { type: "loading" }
  | { type: "error" }
  | { type: "loaded"; vote: VoteState; viewerId: string | null };
interface TicketVoteProps {
  ticketId: string;
  currentUser?: AuthenticatedUser | null;
}

export function TicketVote({ ticketId, currentUser = null }: TicketVoteProps) {
  const viewerId = currentUser?.id ?? null;
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    setLoad({ type: "loading" });
    getTicketVote(ticketId).then(
      (vote) => {
        if (!ignore) setLoad({ type: "loaded", vote, viewerId });
      },
      () => {
        if (!ignore) setLoad({ type: "error" });
      }
    );
    return () => {
      ignore = true;
    };
  }, [ticketId, viewerId, attempt]);

  if (load.type === "error")
    return (
      <div className="ticket-voting-error" role="alert">
        <p>We couldn&apos;t load the ticket votes. Please try again.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry ticket votes
        </button>
      </div>
    );
  if (load.type === "loading" || load.viewerId !== viewerId)
    return (
      <p className="field-hint" role="status">
        Loading ticket votes…
      </p>
    );
  return (
    <VoteControls
      key={`${ticketId}:${viewerId ?? "anonymous"}`}
      subject="ticket"
      initialState={{ ...load.vote, userVote: currentUser ? load.vote.userVote : null }}
      canVote={currentUser !== null}
      saveVote={(value) => setTicketVote(ticketId, value)}
    />
  );
}
