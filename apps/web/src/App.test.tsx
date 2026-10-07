import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ tickets: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("shows the submitted tickets on the homepage", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Submitted tickets" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
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
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a single ticket at /tickets/:id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
            title: "Laptop will not start",
            description: "The power light flashes once.",
            setup: "Framework Laptop 13, Fedora 42",
            additionalInformation: null,
            status: "OPEN",
            createdAt: "2026-09-28T18:00:00.000Z",
            updatedAt: "2026-09-28T18:00:00.000Z"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    window.history.pushState({}, "", "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6");
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Laptop will not start" })
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6");
    expect(screen.getByRole("link", { name: "← All tickets" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Tickets" })).not.toHaveAttribute("aria-current");
  });
});
