import { useEffect } from "react";

import { TicketForm } from "./tickets/TicketForm.js";
import { TicketList } from "./tickets/TicketList.js";

const newTicketPath = "/new";

export function App() {
  const isNewTicketPage = window.location.pathname.replace(/\/+$/, "") === newTicketPath;

  useEffect(() => {
    document.title = isNewTicketPage ? "Create a ticket | BetterTicket" : "Tickets | BetterTicket";
  }, [isNewTicketPage]);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="BetterTicket home">
          <span className="brand-mark" aria-hidden="true">
            BT
          </span>
          <span>BetterTicket</span>
        </a>

        <nav className="site-nav" aria-label="Main">
          <a href="/" aria-current={isNewTicketPage ? undefined : "page"}>
            Tickets
          </a>
          <a href={newTicketPath} aria-current={isNewTicketPage ? "page" : undefined}>
            New ticket
          </a>
        </nav>
      </header>

      {isNewTicketPage ? (
        <main className="form-page">
          <section className="intro" aria-labelledby="page-title">
            <p className="eyebrow">Support request</p>
            <h1 id="page-title">Tell us what went wrong.</h1>
            <p>
              Share enough context for a technician to start investigating. You can create this
              ticket without an account.
            </p>
          </section>

          <section className="form-panel" aria-label="Create a support ticket">
            <TicketForm />
          </section>
        </main>
      ) : (
        <main className="tickets-page">
          <section className="tickets-intro" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">Ticket queue</p>
              <h1 id="page-title">Submitted tickets</h1>
              <p>Every ticket submitted to BetterTicket, newest first.</p>
            </div>
            <a className="primary-link" href={newTicketPath}>
              Create a ticket
            </a>
          </section>

          <TicketList />
        </main>
      )}

      <footer>
        <p>
          Tickets are publicly visible. Do not include passwords, access keys, or other sensitive
          information.
        </p>
      </footer>
    </>
  );
}
