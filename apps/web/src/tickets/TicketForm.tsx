import { useState, type FormEvent } from "react";

import { createTicket, ticketPath, type CreateTicketInput } from "./ticket-api.js";

type SubmissionState =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "success"; ticketId: string }
  | { type: "error" };

const initialState: SubmissionState = { type: "idle" };

function readFormInput(form: HTMLFormElement): CreateTicketInput {
  const formData = new FormData(form);
  const additionalInformation = String(formData.get("additionalInformation") ?? "").trim();

  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    setup: String(formData.get("setup") ?? "").trim(),
    ...(additionalInformation ? { additionalInformation } : {})
  };
}

export function TicketForm() {
  const [submission, setSubmission] = useState<SubmissionState>(initialState);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmission({ type: "submitting" });

    try {
      const ticket = await createTicket(readFormInput(form));
      form.reset();
      setSubmission({ type: "success", ticketId: ticket.id });
    } catch {
      setSubmission({ type: "error" });
    }
  }

  const isSubmitting = submission.type === "submitting";

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting}>
        <legend>Issue details</legend>

        <div className="field">
          <label htmlFor="title">Title</label>
          <p className="field-hint" id="title-hint">
            A short summary that helps a technician scan the queue.
          </p>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={160}
            aria-describedby="title-hint"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="description">What is happening?</label>
          <p className="field-hint" id="description-hint">
            Include what you expected, what happened, and any messages you saw.
          </p>
          <textarea
            id="description"
            name="description"
            rows={6}
            maxLength={5_000}
            aria-describedby="description-hint"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="setup">Your setup</label>
          <p className="field-hint" id="setup-hint">
            Device, operating system, browser, app version, or other relevant context.
          </p>
          <textarea
            id="setup"
            name="setup"
            rows={4}
            maxLength={3_000}
            aria-describedby="setup-hint"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="additional-information">Additional information</label>
          <p className="field-hint" id="additional-information-hint">
            Optional steps already tried, timing details, or anything else that may help.
          </p>
          <textarea
            id="additional-information"
            name="additionalInformation"
            rows={4}
            maxLength={3_000}
            aria-describedby="additional-information-hint"
          />
        </div>

        <button className="submit-button" type="submit">
          {isSubmitting ? "Creating ticket…" : "Create ticket"}
        </button>
      </fieldset>

      <div className="submission-message" aria-live="polite">
        {submission.type === "success" ? (
          <div className="success-message">
            <strong>Your ticket has been created.</strong>
            <span>
              Reference <code>{submission.ticketId.slice(0, 8)}</code> ·{" "}
              <a href={ticketPath(submission.ticketId)}>View ticket</a>
            </span>
          </div>
        ) : null}
      </div>

      {submission.type === "error" ? (
        <p className="error-message" role="alert">
          We couldn&apos;t create your ticket. Please try again.
        </p>
      ) : null}
    </form>
  );
}
