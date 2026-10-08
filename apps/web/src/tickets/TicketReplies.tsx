import { useEffect, useState, type FormEvent } from "react";

import { createReply, listReplies, type Reply } from "./ticket-api.js";
import { formatCreatedAt } from "./ticket-format.js";

type LoadState = { type: "loading" } | { type: "loaded"; replies: Reply[] } | { type: "error" };

type SubmissionState =
  { type: "idle" } | { type: "submitting" } | { type: "success" } | { type: "error" };

interface TicketRepliesProps {
  ticketId: string;
}

export function TicketReplies({ ticketId }: TicketRepliesProps) {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [submission, setSubmission] = useState<SubmissionState>({ type: "idle" });

  useEffect(() => {
    let ignore = false;

    listReplies(ticketId).then(
      (replies) => {
        if (!ignore) {
          setLoad({ type: "loaded", replies });
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    setSubmission({ type: "submitting" });

    try {
      const reply = await createReply(ticketId, body);
      form.reset();
      setLoad((current) =>
        current.type === "loaded"
          ? { type: "loaded", replies: [...current.replies, reply] }
          : current
      );
      setSubmission({ type: "success" });
    } catch {
      setSubmission({ type: "error" });
    }
  }

  return (
    <section className="replies" aria-labelledby="replies-title">
      <h2 id="replies-title">Replies</h2>

      {load.type === "loading" ? (
        <p className="list-message" role="status">
          Loading replies…
        </p>
      ) : null}

      {load.type === "error" ? (
        <div className="error-message" role="alert">
          <p>We couldn&apos;t load the replies. Please try again.</p>
          <button className="submit-button" type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}

      {load.type === "loaded" ? (
        <>
          {load.replies.length === 0 ? (
            <p className="list-message">No replies yet.</p>
          ) : (
            <ol className="reply-list">
              {load.replies.map((reply) => (
                <li className="reply" key={reply.id}>
                  <p className="ticket-meta">
                    Replied{" "}
                    <time dateTime={reply.createdAt}>{formatCreatedAt(reply.createdAt)}</time>
                  </p>
                  <p className="ticket-text">{reply.body}</p>
                </li>
              ))}
            </ol>
          )}

          <form className="reply-form" onSubmit={handleSubmit}>
            <fieldset disabled={submission.type === "submitting"}>
              <legend>Add a reply</legend>

              <div className="field">
                <label htmlFor="reply-body">Your reply</label>
                <p className="field-hint" id="reply-body-hint">
                  Replies are anonymous and publicly visible. You can reply without an account.
                </p>
                <textarea
                  id="reply-body"
                  name="body"
                  rows={4}
                  maxLength={5_000}
                  aria-describedby="reply-body-hint"
                  required
                />
              </div>

              <button className="submit-button" type="submit">
                {submission.type === "submitting" ? "Posting reply…" : "Post reply"}
              </button>
            </fieldset>

            <div className="submission-message" aria-live="polite">
              {submission.type === "success" ? (
                <p className="success-message">Your reply has been posted.</p>
              ) : null}
            </div>

            {submission.type === "error" ? (
              <p className="error-message" role="alert">
                We couldn&apos;t post your reply. Please try again.
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </section>
  );
}
