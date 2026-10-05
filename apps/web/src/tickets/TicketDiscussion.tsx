import { useEffect, useState, type FormEvent } from "react";

import {
  createComment,
  getTicket,
  setSpotlight,
  setSolution,
  toggleHelpful,
  type CurrentUser,
  type TicketDetail
} from "./ticket-api.js";

export function TicketDiscussion({
  ticketId,
  user,
  csrfToken
}: {
  ticketId: string;
  user: CurrentUser;
  csrfToken: string;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [error, setError] = useState(false);

  const refresh = () =>
    getTicket(ticketId)
      .then(setTicket)
      .catch(() => setError(true));
  useEffect(() => {
    refresh();
  }, [ticketId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    try {
      await createComment(ticketId, body, replyTo, csrfToken);
      form.reset();
      setReplyTo(undefined);
      refresh();
    } catch {
      setError(true);
    }
  }

  if (error)
    return (
      <p className="error-message" role="alert">
        We couldn&apos;t load or update this discussion.
      </p>
    );
  if (!ticket) return <p aria-live="polite">Loading discussion…</p>;
  const roots = ticket.comments.filter((comment) => !comment.parentCommentId);
  return (
    <section className="discussion" aria-label="Ticket discussion">
      <p className="eyebrow">{ticket.status === "RESOLVED" ? "Resolved" : "Open"} ticket</p>
      <h2>{ticket.title}</h2>
      <p>{ticket.description}</p>
      <h3>Discussion</h3>
      <div className="comment-list">
        {roots.map((comment) => (
          <article
            className={`comment ${ticket.solutionCommentId === comment.id ? "solution" : ""}`}
            key={comment.id}
          >
            {ticket.solutionCommentId === comment.id ? <strong>Approved solution</strong> : null}
            {comment.isSpotlighted ? <strong> IT spotlight</strong> : null}
            <p>{comment.deletedAt ? "This comment has been removed." : comment.body}</p>
            {!comment.deletedAt ? (
              <div className="comment-actions">
                <button type="button" onClick={() => setReplyTo(comment.id)}>
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => toggleHelpful(comment.id, csrfToken).then(refresh)}
                >
                  Helpful ({comment.helpfulCount})
                </button>
                {user.role !== "USER" ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSpotlight(comment.id, !comment.isSpotlighted, csrfToken).then(refresh)
                      }
                    >
                      {comment.isSpotlighted ? "Remove spotlight" : "Spotlight"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolution(ticketId, comment.id, csrfToken).then(refresh)}
                    >
                      Approve solution
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {ticket.comments
              .filter((reply) => reply.parentCommentId === comment.id)
              .map((reply) => (
                <article
                  className={`comment reply ${ticket.solutionCommentId === reply.id ? "solution" : ""}`}
                  key={reply.id}
                >
                  <p>{reply.deletedAt ? "This reply has been removed." : reply.body}</p>
                  <button
                    type="button"
                    onClick={() => toggleHelpful(reply.id, csrfToken).then(refresh)}
                  >
                    Helpful ({reply.helpfulCount})
                  </button>
                  {user.role !== "USER" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setSpotlight(reply.id, !reply.isSpotlighted, csrfToken).then(refresh)
                        }
                      >
                        {reply.isSpotlighted ? "Remove spotlight" : "Spotlight"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSolution(ticketId, reply.id, csrfToken).then(refresh)}
                      >
                        Approve solution
                      </button>
                    </>
                  ) : null}
                </article>
              ))}
          </article>
        ))}
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="comment-body">{replyTo ? "Reply" : "Add a comment"}</label>
          <textarea id="comment-body" name="body" rows={4} maxLength={5000} required />
        </div>
        <button className="submit-button" type="submit">
          Post {replyTo ? "reply" : "comment"}
        </button>
        {replyTo ? (
          <button type="button" onClick={() => setReplyTo(undefined)}>
            Cancel reply
          </button>
        ) : null}
      </form>
    </section>
  );
}
