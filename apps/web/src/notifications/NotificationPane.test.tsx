import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationPane, notificationPollIntervalMs } from "./NotificationPane.js";

const unreadNotification = {
  id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  ticketId: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  ticketTitle: "Printer offline",
  previousStatus: "UNDER_REVIEW",
  newStatus: "IN_PROGRESS",
  createdAt: "2026-10-19T18:00:00.000Z",
  readAt: null
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function stubNotifications(...lists: Array<{ notifications: unknown[]; unreadCount: number }>) {
  const responses = [...lists];
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    if (path === "/api/notifications/read" && init?.method === "POST") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    const list = responses.length > 1 ? responses.shift()! : responses[0]!;
    return Promise.resolve(jsonResponse(list));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NotificationPane", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the unread count and lists status changes with ticket links", async () => {
    stubNotifications({ notifications: [unreadNotification], unreadCount: 1 });
    render(<NotificationPane />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications: 1 unread" }));

    const pane = screen.getByRole("region", { name: "Notifications" });
    expect(pane).toHaveTextContent("New: Printer offline moved from Under review to In progress");
    expect(screen.getByRole("link", { name: /Printer offline/ })).toHaveAttribute(
      "href",
      "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6"
    );
    expect(pane.querySelector("time")).toHaveAttribute("datetime", "2026-10-19T18:00:00.000Z");
  });

  it("marks notifications read when opened", async () => {
    const fetchMock = stubNotifications({ notifications: [unreadNotification], unreadCount: 1 });
    render(<NotificationPane />);

    fireEvent.click(await screen.findByRole("button", { name: "Notifications: 1 unread" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read", { method: "POST" });
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("does not mark read when nothing is unread", async () => {
    const fetchMock = stubNotifications({
      notifications: [{ ...unreadNotification, readAt: "2026-10-19T18:05:00.000Z" }],
      unreadCount: 0
    });
    render(<NotificationPane />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("region", { name: "Notifications" })).not.toHaveTextContent("New:");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/notifications/read", expect.anything());
  });

  it("shows an empty state", async () => {
    const fetchMock = stubNotifications({ notifications: [], unreadCount: 0 });
    render(<NotificationPane />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(/You'll see updates here/)).toBeInTheDocument();
  });

  it("shows an error when notifications cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    );
    render(<NotificationPane />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't refresh your notifications."
    );
  });

  it("polls for new notifications and refreshes when the window regains focus", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const fetchMock = stubNotifications(
      { notifications: [], unreadCount: 0 },
      { notifications: [unreadNotification], unreadCount: 1 },
      { notifications: [unreadNotification, unreadNotification], unreadCount: 2 }
    );
    render(<NotificationPane />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    await act(() => vi.advanceTimersByTimeAsync(notificationPollIntervalMs));
    expect(
      await screen.findByRole("button", { name: "Notifications: 1 unread" })
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(
      await screen.findByRole("button", { name: "Notifications: 2 unread" })
    ).toBeInTheDocument();
  });

  it("stops polling after unmounting", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const fetchMock = stubNotifications({ notifications: [], unreadCount: 0 });
    const { unmount } = render(<NotificationPane />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    unmount();
    await vi.advanceTimersByTimeAsync(notificationPollIntervalMs * 2);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("closes with Escape", async () => {
    stubNotifications({ notifications: [], unreadCount: 0 });
    render(<NotificationPane />);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
