import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthGateway } from "./AuthGateway.js";

describe("AuthGateway", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a visitor continue anonymously", () => {
    render(<AuthGateway onAuthenticated={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Continue anonymously" })).toHaveAttribute(
      "href",
      "/tickets"
    );
  });

  it("signs in and continues to the ticket list", async () => {
    const onAuthenticated = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
            name: "Uma User",
            username: "uma",
            role: "USER"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(<AuthGateway onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "uma" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "uma", password: "correct horse battery staple" })
    });
  });

  it("returns to sign-in with the registered username", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
            name: "Uma User",
            username: "uma",
            role: "USER"
          }),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(<AuthGateway onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Uma User" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "uma" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" }
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "correct horse battery staple" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Account created. Sign in to continue.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("uma");
    expect(fetch).toHaveBeenCalledWith("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Uma User",
        username: "uma",
        password: "correct horse battery staple"
      })
    });
  });

  it("does not submit registration until passwords match", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<AuthGateway onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Uma User" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "uma" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password one" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password two" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(fetch).not.toHaveBeenCalled();
  });
});
