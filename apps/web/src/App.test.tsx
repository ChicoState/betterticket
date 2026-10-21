import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve(
          path === "/api/sessions/current"
            ? new Response(null, { status: 401 })
            : new Response(JSON.stringify({ tickets: [] }), {
                status: 200,
                headers: { "content-type": "application/json" }
              })
        )
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("shows the account gateway on the homepage", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Get help your way." })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue anonymously" })).toHaveAttribute(
      "href",
      "/tickets"
    );
    expect(screen.queryByRole("link", { name: "Tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New ticket" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/sessions/current");
  });

  it("sends an already signed-in visitor from the gateway to the ticket list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve(
          path === "/api/sessions/current"
            ? new Response(
                JSON.stringify({
                  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
                  name: "Uma User",
                  username: "uma",
                  role: "USER"
                }),
                { status: 200, headers: { "content-type": "application/json" } }
              )
            : new Response(JSON.stringify({ tickets: [] }), {
                status: 200,
                headers: { "content-type": "application/json" }
              })
        )
      )
    );
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Submitted tickets" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/tickets");
  });

  it("shows notifications only to signed-in visitors", async () => {
    window.history.pushState({}, "", "/tickets");
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              path === "/api/sessions/current"
                ? {
                    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
                    name: "Uma User",
                    username: "uma",
                    role: "USER"
                  }
                : path === "/api/notifications"
                  ? { notifications: [], unreadCount: 2 }
                  : { tickets: [] }
            ),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        )
      )
    );
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Notifications: 2 unread" })
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/notifications");
  });

  it("does not show notifications to anonymous visitors", async () => {
    window.history.pushState({}, "", "/tickets");
    render(<App />);

    expect(await screen.findByRole("button", { name: "Account: Anonymous" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Notifications/ })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/notifications");
  });

  it("shows the submitted tickets at /tickets", async () => {
    window.history.pushState({}, "", "/tickets");
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Submitted tickets" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New ticket" })).toHaveAttribute("href", "/new");
    expect(await screen.findByText("No tickets have been submitted yet.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/tickets");
  });

  it("shows the ticket form at /new", () => {
    window.history.pushState({}, "", "/new");
    render(<App />);

    expect(screen.getByRole("button", { name: "Create ticket" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New ticket" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("href", "/tickets");
    expect(fetch).toHaveBeenCalledWith("/api/sessions/current");
  });

  it("shows a single ticket at /tickets/:id", async () => {
    const ticket = {
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
      createdByName: null,
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(JSON.stringify(url.endsWith("/replies") ? { replies: [] } : ticket), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      )
    );
    window.history.pushState({}, "", "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6");
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Laptop will not start" })
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6");
    expect(screen.getByRole("link", { name: "← All tickets" })).toHaveAttribute("href", "/tickets");
    expect(await screen.findByRole("button", { name: "Post reply" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets" })).not.toHaveAttribute("aria-current");
  });

  it("passes technician access to ticket status controls", async () => {
    const ticket = {
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
      createdByName: null,
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/sessions/current") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "technician-id",
                name: "Tara Technician",
                username: "tara",
                role: "TECHNICIAN"
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify(url.endsWith("/replies") ? { replies: [] } : ticket), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );
      })
    );
    window.history.pushState({}, "", "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6");
    render(<App />);

    expect(await screen.findByRole("button", { name: "Move to Under review" })).toBeInTheDocument();
  });

  it("shows the signed-in account menu and revalidates it after history restoration", async () => {
    let sessionChecks = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/sessions/current") {
          sessionChecks += 1;
          return Promise.resolve(
            sessionChecks === 1
              ? new Response(
                  JSON.stringify({
                    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
                    name: "Uma User",
                    username: "uma",
                    role: "USER"
                  }),
                  { status: 200, headers: { "content-type": "application/json" } }
                )
              : new Response(null, { status: 401 })
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ tickets: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );
      })
    );
    window.history.pushState({}, "", "/tickets");
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Account: Signed in as Uma User" })
    ).toBeInTheDocument();

    window.dispatchEvent(new Event("pageshow"));

    expect(await screen.findByRole("button", { name: "Account: Anonymous" })).toBeInTheDocument();
  });
});
