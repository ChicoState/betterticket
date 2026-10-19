import { useEffect, useState } from "react";

import { AccountMenu, type AccountSession } from "./auth/AccountMenu.js";
import { AuthGateway } from "./auth/AuthGateway.js";
import { getCurrentUser, logout } from "./auth/auth-api.js";
import { TicketDetail } from "./tickets/TicketDetail.js";
import { TicketForm } from "./tickets/TicketForm.js";
import { TicketList } from "./tickets/TicketList.js";

const newTicketPath = "/new";
const ticketListPath = "/tickets";

const pageTitles = {
  login: "Welcome",
  list: "Tickets",
  new: "Create a ticket",
  ticket: "Ticket details"
};

type Page =
  { type: "login" } | { type: "list" } | { type: "new" } | { type: "ticket"; ticketId: string };

function readPage(pathname: string): Page {
  const path = pathname.replace(/\/+$/, "");
  const ticketId = /^\/tickets\/([^/]+)$/.exec(path)?.[1];

  if (ticketId) {
    return { type: "ticket", ticketId: decodeTicketId(ticketId) };
  }

  if (path === ticketListPath) {
    return { type: "list" };
  }

  return path === newTicketPath ? { type: "new" } : { type: "login" };
}

function decodeTicketId(ticketId: string): string {
  try {
    return decodeURIComponent(ticketId);
  } catch {
    return ticketId;
  }
}

export function App() {
  const page = readPage(window.location.pathname);
  const [, refreshLocation] = useState(0);
  const [session, setSession] = useState<AccountSession | null>(null);
  const isLoginPage = page.type === "login";
  const isNewTicketPage = page.type === "new";

  useEffect(() => {
    let ignore = false;

    async function refreshSession() {
      setSession(null);

      try {
        const user = await getCurrentUser();
        if (!ignore) {
          setSession(user ? { type: "authenticated", user } : { type: "anonymous" });
        }
      } catch {
        // Avoid presenting an anonymous status when the server could not verify the session.
      }
    }

    void refreshSession();
    window.addEventListener("pageshow", refreshSession);
    return () => {
      ignore = true;
      window.removeEventListener("pageshow", refreshSession);
    };
  }, []);

  useEffect(() => {
    document.title = `${pageTitles[page.type]} | BetterTicket`;
  }, [page.type]);

  useEffect(() => {
    if (page.type === "login" && session?.type === "authenticated") {
      window.history.replaceState({}, "", ticketListPath);
      refreshLocation((current) => current + 1);
    }
  }, [page.type, session]);

  async function handleLogout() {
    await logout();
    window.location.replace("/");
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

        {isLoginPage ? null : (
          <div className="header-actions">
            <nav className="site-nav" aria-label="Main">
              <a href={ticketListPath} aria-current={page.type === "list" ? "page" : undefined}>
                Tickets
              </a>
              <a href={newTicketPath} aria-current={isNewTicketPage ? "page" : undefined}>
                New ticket
              </a>
            </nav>
            {session ? <AccountMenu session={session} onLogout={handleLogout} /> : null}
          </div>
        )}
      </header>

      {page.type === "ticket" ? (
        <main className="tickets-page">
          <a className="back-link" href={ticketListPath}>
            ← All tickets
          </a>

          <TicketDetail ticketId={page.ticketId} />
        </main>
      ) : isNewTicketPage ? (
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
            <TicketForm currentUser={session?.type === "authenticated" ? session.user : null} />
          </section>
        </main>
      ) : page.type === "list" ? (
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
      ) : (
        <AuthGateway onAuthenticated={() => window.location.assign(ticketListPath)} />
      )}

      <footer>
        <p>
          Choose ticket visibility when creating a request. Do not include passwords, access keys,
          or other sensitive information.
        </p>
      </footer>
    </>
  );
}
