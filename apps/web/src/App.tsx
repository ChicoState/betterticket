import { TicketForm } from "./tickets/TicketForm.js";

export function App() {
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
          <p className="eyebrow">Support request</p>
          <h1 id="page-title">Tell us what went wrong.</h1>
          <p>
            Share enough context for a technician to start investigating. You can create this ticket
            without an account.
          </p>
        </section>

        <section className="form-panel" aria-label="Create a support ticket">
          <TicketForm />
        </section>
      </main>

      <footer>
        <p>Do not include passwords, access keys, or other sensitive information.</p>
      </footer>
    </>
  );
}
