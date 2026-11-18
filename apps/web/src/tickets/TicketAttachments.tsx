import { useEffect, useState } from "react";

import {
  listTicketAttachments,
  ticketAttachmentPath,
  type TicketAttachment
} from "./ticket-api.js";

type LoadState =
  { type: "loading" } | { type: "loaded"; attachments: TicketAttachment[] } | { type: "error" };

function formatSize(sizeBytes: number): string {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachments({ ticketId }: { ticketId: string }) {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    listTicketAttachments(ticketId).then(
      (attachments) => {
        if (!ignore) setLoad({ type: "loaded", attachments });
      },
      () => {
        if (!ignore) setLoad({ type: "error" });
      }
    );
    return () => {
      ignore = true;
    };
  }, [ticketId, attempt]);

  if (load.type === "loading") {
    return <p className="attachment-status">Loading attachments…</p>;
  }
  if (load.type === "error") {
    return (
      <section className="ticket-attachments" aria-labelledby="attachments-title">
        <h2 id="attachments-title">Attachments</h2>
        <p>We couldn&apos;t load the attachments.</p>
        <button
          className="status-update-button"
          onClick={() => {
            setLoad({ type: "loading" });
            setAttempt((current) => current + 1);
          }}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }
  if (load.attachments.length === 0) {
    return null;
  }

  return (
    <section className="ticket-attachments" aria-labelledby="attachments-title">
      <h2 id="attachments-title">Attachments</h2>
      <ul className="attachment-list">
        {load.attachments.map((attachment) => {
          const downloadPath = ticketAttachmentPath(ticketId, attachment.id);
          return (
            <li key={attachment.id}>
              {attachment.contentType.startsWith("image/") ? (
                <img
                  alt={`Preview of ${attachment.fileName}`}
                  loading="lazy"
                  src={ticketAttachmentPath(ticketId, attachment.id, true)}
                />
              ) : null}
              <div>
                <a download href={downloadPath}>
                  Download {attachment.fileName}
                </a>
                <span>{formatSize(attachment.sizeBytes)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
