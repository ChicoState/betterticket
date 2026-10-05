import { useState, type FormEvent } from "react";

import { TicketDiscussion } from "./tickets/TicketDiscussion.js";
import { TicketForm } from "./tickets/TicketForm.js";
import { login, type CurrentUser } from "./tickets/ticket-api.js";

export function App() {
  const [session, setSession] = useState<{ user: CurrentUser; csrfToken: string } | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setSession(await login(String(form.get("email") ?? ""), String(form.get("password") ?? "")));
      setLoginError(false);
    } catch {
      setLoginError(true);
    }
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="BetterTicket home">
          <span className="brand-mark" aria-hidden="true">
            BT
          </span>
          <span>BetterTicket</span>
        </a>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">Support community</p>
          <h1 id="page-title">Find a fix together.</h1>
          <p>
            Share a support request, add context to existing tickets, and help surface answers for
            IT to approve.
          </p>
        </section>

        <section className="form-panel" aria-label="Support ticket">
          {!session ? (
            <form onSubmit={signIn}>
              <fieldset>
                <legend>Sign in</legend>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" required />
                </div>
                <button className="submit-button" type="submit">
                  Sign in
                </button>
              </fieldset>
              {loginError ? (
                <p className="error-message" role="alert">
                  We couldn&apos;t sign you in. Check your email and password.
                </p>
              ) : null}
            </form>
          ) : ticketId ? (
            <TicketDiscussion
              ticketId={ticketId}
              user={session.user}
              csrfToken={session.csrfToken}
            />
          ) : (
            <TicketForm csrfToken={session.csrfToken} onCreated={setTicketId} />
          )}
        </section>
      </main>

      <footer>
        <p>Do not include passwords, access keys, or other sensitive information.</p>
      </footer>
    </>
  );
}
