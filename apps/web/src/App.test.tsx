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
});
