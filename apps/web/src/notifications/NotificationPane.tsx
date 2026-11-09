import { useEffect, useRef, useState } from "react";

import { ticketPath } from "../tickets/ticket-api.js";
import { formatCreatedAt, formatStatus } from "../tickets/ticket-format.js";
import {
  getNotifications,
  markNotificationsRead,
  type NotificationList
} from "./notification-api.js";

export const notificationPollIntervalMs = 30_000;

function BellIcon() {
  return (
    <svg aria-hidden="true" className="account-icon" viewBox="0 0 24 24">
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function NotificationPane() {
  const [list, setList] = useState<NotificationList | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const unreadCount = list?.unreadCount ?? 0;

  useEffect(() => {
    let ignore = false;

    async function refresh() {
      try {
        const latest = await getNotifications();
        if (!ignore) {
          setList(latest);
          setHasError(false);
        }
      } catch {
        if (!ignore) {
          setHasError(true);
        }
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, notificationPollIntervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      ignore = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (paneRef.current && !paneRef.current.contains(event.target as Node)) {
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

  function toggle() {
    const opening = !isOpen;
    setIsOpen(opening);

    if (opening && unreadCount > 0) {
      // Keep each item's unread styling while the pane is open; only the badge clears.
      setList((current) => current && { ...current, unreadCount: 0 });
      // A failed request leaves notifications unread, so the next poll restores the badge.
      markNotificationsRead().catch(() => undefined);
    }
  }

  return (
    <div className="account-menu notification-menu" ref={paneRef}>
      <button
        aria-controls="notification-pane"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications: ${unreadCount} unread` : "Notifications"}
        className="account-menu-trigger"
        onClick={toggle}
        type="button"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          aria-label="Notifications"
          className="account-menu-popover notification-pane"
          id="notification-pane"
          role="region"
        >
          <h2 className="notification-heading">Notifications</h2>
          {hasError ? (
            <p className="account-menu-error" role="alert">
              We couldn&apos;t refresh your notifications.
            </p>
          ) : null}
          {list && list.notifications.length > 0 ? (
            <ul className="notification-list">
              {list.notifications.map((notification) => (
                <li
                  className={
                    notification.readAt ? "notification-item" : "notification-item is-unread"
                  }
                  key={notification.id}
                >
                  <a href={ticketPath(notification.ticketId)}>
                    {notification.readAt ? null : <span className="notification-new">New: </span>}
                    <strong>{notification.ticketTitle}</strong> moved from{" "}
                    {formatStatus(notification.previousStatus)} to{" "}
                    {formatStatus(notification.newStatus)}
                  </a>
                  <time dateTime={notification.createdAt}>
                    {formatCreatedAt(notification.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : list ? (
            <p className="notification-empty">
              You&apos;ll see updates here when a technician changes the status of your tickets.
            </p>
          ) : hasError ? null : (
            <p className="notification-empty" role="status">
              Loading notifications…
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
