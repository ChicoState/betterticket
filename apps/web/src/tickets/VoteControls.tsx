import { useRef, useState } from "react";
import { VoteError, type VoteValue, type VoteState } from "./ticket-api.js";

interface VoteControlsProps {
  subject: "ticket" | "reply";
  initialState: VoteState;
  canVote: boolean;
  saveVote: (value: VoteValue | null) => Promise<VoteState>;
}

function ThumbIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      className={`vote-icon vote-icon-${direction}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 10v12H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3Zm0 0 4-8a3 3 0 0 1 3 3v4h5a3 3 0 0 1 2.9 3.7l-2 7A3 3 0 0 1 17 22H7" />
    </svg>
  );
}

export function VoteControls({ subject, initialState, canVote, saveVote }: VoteControlsProps) {
  const [state, setState] = useState<VoteState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const pending = useRef(false);
  const disabled = !canVote || saving || sessionExpired;

  async function handleVote(vote: VoteValue) {
    if (disabled || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      setState(await saveVote(state.userVote === vote ? null : vote));
    } catch (cause) {
      if (cause instanceof VoteError && cause.status === 401) {
        setSessionExpired(true);
        setError(`Sign in again to vote on ${subject === "ticket" ? "tickets" : "replies"}.`);
      } else {
        setError("We couldn't save your vote. Please try again.");
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="voting">
      <div
        className="vote-controls"
        role="group"
        aria-label={`${subject === "ticket" ? "Ticket" : "Reply"} votes`}
        aria-busy={saving}
      >
        <button
          type="button"
          aria-label={`Upvote ${subject} (${state.upvotes} upvotes)`}
          aria-pressed={state.userVote === 1}
          disabled={disabled}
          onClick={() => void handleVote(1)}
        >
          <ThumbIcon direction="up" /> {state.upvotes}
        </button>
        <span aria-live="polite">Score {state.upvotes - state.downvotes}</span>
        <button
          type="button"
          aria-label={`Downvote ${subject} (${state.downvotes} downvotes)`}
          aria-pressed={state.userVote === -1}
          disabled={disabled}
          onClick={() => void handleVote(-1)}
        >
          <ThumbIcon direction="down" /> {state.downvotes}
        </button>
      </div>
      {!canVote || sessionExpired ? (
        <p className="field-hint">
          <a href="/">Sign in</a> to vote on {subject === "ticket" ? "tickets" : "replies"}.
        </p>
      ) : null}
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
