import { useEffect, useState, type FormEvent } from "react";

import {
  createReply,
  listReplies,
  TicketClosedError,
  type Reply,
  type ReplyKind,
  type Ticket,
  type TicketReplyStatus,
  type TicketStatus,
  type TicketVisibility
} from "./ticket-api.js";
import { formatCreatedAt } from "./ticket-format.js";
import { SolutionEndorsement } from "./SolutionEndorsement.js";

type LoadState = { type: "loading" } | { type: "loaded"; replies: Reply[] } | { type: "error" };

type SubmissionState =
  { type: "idle" } | { type: "submitting" } | { type: "success" } | { type: "error" };

interface TicketRepliesProps {
  ticketId: string;
  replyStatus?: TicketReplyStatus;
  onTicketClosed?: () => void;
  visibility?: TicketVisibility;
  ticketStatus?: TicketStatus;
  isTechnician?: boolean;
  onTicketUpdated?: (ticket: Ticket) => void;
}

/** Endorsed solutions first (most endorsements, then oldest), then unendorsed oldest first. */
export function sortSolutions(replies: Reply[]): Reply[] {
  return replies
    .filter((reply) => reply.kind === "SOLUTION")
    .map((reply, index) => ({ reply, index }))
    .sort(
      (left, right) =>
        right.reply.endorsements.length - left.reply.endorsements.length || left.index - right.index
    )
    .map(({ reply }) => reply);
}

export function TicketReplies({
  ticketId,
  replyStatus = "OPEN",
  onTicketClosed = () => {},
  visibility = "PUBLIC",
  ticketStatus = "OPEN",
  isTechnician = false,
  onTicketUpdated = () => {}
}: TicketRepliesProps) {
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
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const kind: ReplyKind = formData.get("kind") === "SOLUTION" ? "SOLUTION" : "COMMENT";
    setSubmission({ type: "submitting" });

    try {
      const reply = await createReply(ticketId, body, kind);
      form.reset();
      setLoad((current) =>
        current.type === "loaded"
          ? { type: "loaded", replies: [...current.replies, reply] }
          : current
      );
      setSubmission({ type: "success" });
    } catch (error) {
      if (error instanceof TicketClosedError) {
        onTicketClosed();
      }
      setSubmission({ type: "error" });
    }
  }

  function replaceReply(updated: Reply) {
    setLoad((current) =>
      current.type === "loaded"
        ? {
            type: "loaded",
            replies: current.replies.map((reply) => (reply.id === updated.id ? updated : reply))
          }
        : current
    );
  }

  const solutions = load.type === "loaded" ? sortSolutions(load.replies) : [];
  const comments =
    load.type === "loaded" ? load.replies.filter((reply) => reply.kind === "COMMENT") : [];

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
          <section className="reply-group" aria-labelledby="solutions-title">
            <h3 id="solutions-title">Suggested solutions</h3>
            {solutions.length === 0 ? (
              <p className="list-message">No suggested solutions yet.</p>
            ) : (
              <ol className="reply-list">
                {solutions.map((reply) => (
                  <li
                    className={`reply reply-solution${reply.endorsements.length > 0 ? " reply-endorsed" : ""}`}
                    key={reply.id}
                  >
                    <p className="ticket-meta">
                      {reply.endorsements.length > 0 ? (
                        <span className="endorsed-badge">Endorsed by IT</span>
                      ) : null}{" "}
                      Suggested{" "}
                      <time dateTime={reply.createdAt}>{formatCreatedAt(reply.createdAt)}</time>
                    </p>
                    <p className="ticket-text">{reply.body}</p>
                    <SolutionEndorsement
                      ticketId={ticketId}
                      ticketStatus={ticketStatus}
                      reply={reply}
                      isTechnician={isTechnician}
                      onReplyUpdated={replaceReply}
                      onTicketUpdated={onTicketUpdated}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="reply-group" aria-labelledby="discussion-title">
            <h3 id="discussion-title">Discussion</h3>
            {comments.length === 0 ? (
              <p className="list-message">No comments yet.</p>
            ) : (
              <ol className="reply-list">
                {comments.map((reply) => (
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
          </section>

          {replyStatus === "CLOSED" ? (
            <p className="list-message">This ticket is closed to new replies.</p>
          ) : (
            <form className="reply-form" onSubmit={handleSubmit}>
              <fieldset disabled={submission.type === "submitting"}>
                <legend>Add a reply</legend>

                <fieldset className="reply-kind">
                  <legend>What are you posting?</legend>
                  <div className="checkbox-field">
                    <input
                      id="reply-kind-solution"
                      name="kind"
                      type="radio"
                      value="SOLUTION"
                      required
                    />
                    <label htmlFor="reply-kind-solution">Suggest a solution</label>
                  </div>
                  <div className="checkbox-field">
                    <input id="reply-kind-comment" name="kind" type="radio" value="COMMENT" />
                    <label htmlFor="reply-kind-comment">Add a comment</label>
                  </div>
                </fieldset>

                <div className="field">
                  <label htmlFor="reply-body">Your reply</label>
                  <p className="field-hint" id="reply-body-hint">
                    {visibility === "PUBLIC"
                      ? "Replies are anonymous and publicly visible. You can reply without an account."
                      : "Replies are anonymous to other visitors and visible to everyone allowed to view this ticket."}
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
          )}
        </>
      ) : null}
    </section>
  );
}
