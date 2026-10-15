import { useEffect, useRef, useState } from "react";

import type { AuthenticatedUser } from "./auth-api.js";

export type AccountSession =
  { type: "anonymous" } | { type: "authenticated"; user: AuthenticatedUser };

interface AccountMenuProps {
  session: AccountSession;
  onLogout: () => Promise<void>;
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="account-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.8-3.4 3.5-5.5 7.5-5.5s6.7 2.1 7.5 5.5" />
    </svg>
  );
}

export function AccountMenu({ session, onLogout }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = session.type === "authenticated";
  const isItAccount = isAuthenticated && session.user.role === "TECHNICIAN";
  const accountLabel = isAuthenticated
    ? `Account: Signed in as ${session.user.name}${isItAccount ? " (IT)" : ""}`
    : "Account: Anonymous";

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);

    try {
      await onLogout();
    } catch {
      setError("We couldn't log you out. Please try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-controls="account-options"
        aria-expanded={isOpen}
        aria-label={accountLabel}
        className="account-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <ProfileIcon />
        <span aria-hidden="true" className="account-status-label">
          {isAuthenticated ? "Signed in" : "Anonymous"}
        </span>
        {isItAccount ? (
          <span aria-hidden="true" className="account-it-badge">
            IT
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div aria-label="Account options" className="account-menu-popover" id="account-options">
          <div className="account-menu-identity">
            {isAuthenticated ? (
              <>
                <strong>{session.user.name}</strong>
                <span>@{session.user.username}</span>
              </>
            ) : (
              <strong>Anonymous</strong>
            )}
          </div>
          <button className="account-menu-item" disabled type="button">
            Settings (coming soon)
          </button>
          {isAuthenticated ? (
            <button
              className="account-menu-item account-menu-logout"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </button>
          ) : (
            <a className="account-menu-item" href="/">
              Sign in
            </a>
          )}
          {error ? (
            <p className="account-menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
