import { useState, type ChangeEvent, type DragEvent } from "react";

const maxFiles = 5;
const maxFileBytes = 10 * 1024 * 1024;
const maxTotalBytes = 25 * 1024 * 1024;
const allowedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "pdf",
  "txt",
  "log",
  "docx",
  "xlsx",
  "pptx"
]);

interface TicketAttachmentInputProps {
  files: File[];
  onChange: (files: File[]) => void;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachmentInput({ files, onChange }: TicketAttachmentInputProps) {
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: File[]) {
    const combined = [...files, ...incoming];
    if (combined.length > maxFiles) {
      setError("You can attach up to 5 files.");
      return;
    }
    const invalidType = incoming.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return !allowedExtensions.has(extension);
    });
    if (invalidType) {
      setError(`${invalidType.name} is not an allowed file type.`);
      return;
    }
    const oversized = incoming.find((file) => file.size === 0 || file.size > maxFileBytes);
    if (oversized) {
      setError(`${oversized.name} must be between 1 byte and 10 MB.`);
      return;
    }
    if (combined.reduce((total, file) => total + file.size, 0) > maxTotalBytes) {
      setError("Attachments cannot exceed 25 MB combined.");
      return;
    }
    setError(null);
    onChange(combined);
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="field attachment-field">
      <label htmlFor="ticket-attachments">Attachments</label>
      <p className="field-hint" id="attachment-hint">
        Add up to 5 images, PDFs, text/log files, or Office documents. Maximum 10 MB each and 25 MB
        combined. Files on a public ticket are public.
      </p>
      <div
        className="attachment-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropFiles}
      >
        <span>Drop files here or</span>
        <label className="attachment-picker" htmlFor="ticket-attachments">
          Choose files
        </label>
        <input
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.docx,.xlsx,.pptx"
          aria-describedby="attachment-hint attachment-error"
          id="ticket-attachments"
          multiple
          onChange={chooseFiles}
          type="file"
        />
      </div>
      {files.length > 0 ? (
        <ul className="attachment-selection" aria-label="Selected attachments">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <span>
                <strong>{file.name}</strong> · {formatBytes(file.size)}
              </span>
              <button
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="attachment-error" id="attachment-error" role={error ? "alert" : undefined}>
        {error}
      </p>
    </div>
  );
}
