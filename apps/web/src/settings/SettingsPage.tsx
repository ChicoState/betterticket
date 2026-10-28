import { useEffect, useRef, useState, type FormEvent } from "react";

import type { AccountSession } from "../auth/AccountMenu.js";
import { formatStatus } from "../tickets/ticket-format.js";
import {
  emailStatusOptions,
  getNotificationSettings,
  saveNotificationSettings,
  SettingsApiError,
  type EmailStatusOption,
  type NotificationSettings
} from "./settings-api.js";

type LoadState =
  { type: "loading" } | { type: "error" } | { type: "ready"; settings: NotificationSettings };

type SaveState =
  { type: "idle" } | { type: "saving" } | { type: "saved" } | { type: "error"; message: string };

interface SettingsPageProps {
  session: AccountSession | null;
}

export function SettingsPage({ session }: SettingsPageProps) {
  return (
    <main className="form-page">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Account</p>
        <h1 id="page-title">Settings</h1>
        <p>Choose how BetterTicket tells you when a technician updates one of your tickets.</p>
      </section>

      <section className="form-panel" aria-label="Notification settings">
        {session === null ? (
          <p className="list-message" role="status">
            Loading settings…
          </p>
        ) : session.type === "anonymous" ? (
          <p className="list-message">
            <a href="/">Sign in</a> to manage your notification settings.
          </p>
        ) : (
          <NotificationSettingsForm />
        )}
      </section>
    </main>
  );
}

function NotificationSettingsForm() {
  const [load, setLoad] = useState<LoadState>({ type: "loading" });

  useEffect(() => {
    let ignore = false;

    getNotificationSettings()
      .then((settings) => {
        if (!ignore) {
          setLoad({ type: "ready", settings });
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoad({ type: "error" });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (load.type === "loading") {
    return (
      <p className="list-message" role="status">
        Loading settings…
      </p>
    );
  }

  if (load.type === "error") {
    return (
      <p className="error-message" role="alert">
        We couldn&apos;t load your settings. Please refresh the page.
      </p>
    );
  }

  return <EmailSettingsFields initialSettings={load.settings} />;
}

function EmailSettingsFields({ initialSettings }: { initialSettings: NotificationSettings }) {
  const [email, setEmail] = useState(initialSettings.email ?? "");
  const [emailEnabled, setEmailEnabled] = useState(initialSettings.emailEnabled);
  const [emailStatuses, setEmailStatuses] = useState<EmailStatusOption[]>(
    initialSettings.emailStatuses
  );
  const [save, setSave] = useState<SaveState>({ type: "idle" });
  const emailInputRef = useRef<HTMLInputElement>(null);
  const statusesRef = useRef<HTMLFieldSetElement>(null);

  // Clear a previous result once the form changes so it never describes unsaved values.
  function clearSaveResult() {
    setSave((current) => (current.type === "saving" ? current : { type: "idle" }));
  }

  function toggleStatus(status: EmailStatusOption, checked: boolean) {
    clearSaveResult();
    setEmailStatuses((current) =>
      emailStatusOptions.filter((option) =>
        option === status ? checked : current.includes(option)
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (emailEnabled && !trimmedEmail) {
      setSave({ type: "error", message: "Add an email address to turn on email updates." });
      emailInputRef.current?.focus();
      return;
    }
    if (emailEnabled && emailStatuses.length === 0) {
      setSave({ type: "error", message: "Choose at least one status to be emailed about." });
      statusesRef.current?.querySelector("input")?.focus();
      return;
    }

    setSave({ type: "saving" });
    try {
      const saved = await saveNotificationSettings({
        email: trimmedEmail || null,
        emailEnabled,
        emailStatuses
      });
      setEmail(saved.email ?? "");
      setEmailEnabled(saved.emailEnabled);
      setEmailStatuses(saved.emailStatuses);
      setSave({ type: "saved" });
    } catch (error) {
      setSave({
        type: "error",
        message:
          error instanceof SettingsApiError
            ? error.message
            : "We couldn't save your settings. Please try again."
      });
    }
  }

  const isSaving = save.type === "saving";

  return (
    <form className="ticket-form settings-form" onSubmit={handleSubmit}>
      <fieldset disabled={isSaving}>
        <legend>Email notifications</legend>

        <div className="field">
          <label htmlFor="settings-email">Email address</label>
          <p className="field-hint" id="settings-email-hint">
            Only you can see this address. It is never shown on tickets.
          </p>
          <input
            id="settings-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-describedby="settings-email-hint"
            ref={emailInputRef}
            value={email}
            onChange={(event) => {
              clearSaveResult();
              setEmail(event.target.value);
            }}
          />
        </div>

        <div className="field checkbox-field">
          <input
            id="settings-email-enabled"
            name="emailEnabled"
            type="checkbox"
            checked={emailEnabled}
            onChange={(event) => {
              clearSaveResult();
              setEmailEnabled(event.target.checked);
            }}
          />
          <label htmlFor="settings-email-enabled">Email me about ticket status changes</label>
        </div>

        <fieldset className="settings-statuses" disabled={!emailEnabled} ref={statusesRef}>
          <legend>Send an email when a ticket moves to</legend>
          {emailStatusOptions.map((status) => (
            <div className="field checkbox-field" key={status}>
              <input
                id={`settings-status-${status}`}
                name="emailStatuses"
                type="checkbox"
                value={status}
                checked={emailStatuses.includes(status)}
                onChange={(event) => {
                  toggleStatus(status, event.target.checked);
                }}
              />
              <label htmlFor={`settings-status-${status}`}>{formatStatus(status)}</label>
            </div>
          ))}
        </fieldset>

        <p className="field-hint">
          Email delivery is coming soon. In-app notifications stay on either way.
        </p>

        <button className="submit-button" type="submit">
          {isSaving ? "Saving…" : "Save settings"}
        </button>
      </fieldset>

      <div className="submission-message" aria-live="polite">
        {save.type === "saved" ? (
          <div className="success-message">
            <strong>Your settings have been saved.</strong>
          </div>
        ) : null}
      </div>

      {save.type === "error" ? (
        <p className="error-message" role="alert">
          {save.message}
        </p>
      ) : null}
    </form>
  );
}
