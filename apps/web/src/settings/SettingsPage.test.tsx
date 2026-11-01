import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage.js";

const session = {
  type: "authenticated" as const,
  user: {
    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
    name: "Uma User",
    username: "uma",
    role: "USER" as const
  }
};

const defaultSettings = { email: null, emailEnabled: false, emailStatuses: ["RESOLVED"] };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function stubSettings(stored: unknown, saveResponse?: () => Response) {
  const fetchMock = vi.fn((_path: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === "PUT"
        ? (saveResponse?.() ?? jsonResponse(JSON.parse(String(init.body))))
        : jsonResponse(stored)
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading state while the session is unknown", () => {
    render(<SettingsPage session={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading settings…");
  });

  it("asks anonymous visitors to sign in", () => {
    const fetchMock = stubSettings(defaultSettings);
    render(<SettingsPage session={{ type: "anonymous" }} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills the form from saved settings", async () => {
    stubSettings({
      email: "uma@example.com",
      emailEnabled: true,
      emailStatuses: ["UNDER_REVIEW", "RESOLVED"]
    });
    render(<SettingsPage session={session} />);

    expect(await screen.findByLabelText("Email address")).toHaveValue("uma@example.com");
    expect(screen.getByLabelText("Email me about ticket status changes")).toBeChecked();
    expect(screen.getByLabelText("Under review")).toBeChecked();
    expect(screen.getByLabelText("In progress")).not.toBeChecked();
    expect(screen.getByLabelText("Resolved")).toBeChecked();
    expect(screen.getByLabelText("Resolved")).toBeEnabled();
  });

  it("disables status choices while email updates are off", async () => {
    stubSettings(defaultSettings);
    render(<SettingsPage session={session} />);

    const statuses = await screen.findByRole("group", {
      name: "Send an email when a ticket moves to"
    });
    expect(statuses).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Email me about ticket status changes"));

    expect(statuses).toBeEnabled();
  });

  it("asks for an email address before turning on email updates", async () => {
    const fetchMock = stubSettings(defaultSettings);
    render(<SettingsPage session={session} />);

    fireEvent.click(await screen.findByLabelText("Email me about ticket status changes"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add an email address");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks for at least one status before turning on email updates", async () => {
    const fetchMock = stubSettings(defaultSettings);
    render(<SettingsPage session={session} />);

    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "uma@example.com" }
    });
    fireEvent.click(screen.getByLabelText("Email me about ticket status changes"));
    fireEvent.click(screen.getByLabelText("Resolved"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one status");
    expect(screen.getByLabelText("Under review")).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves the chosen settings", async () => {
    const fetchMock = stubSettings(defaultSettings);
    render(<SettingsPage session={session} />);

    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "  uma@example.com " }
    });
    fireEvent.click(screen.getByLabelText("Email me about ticket status changes"));
    fireEvent.click(screen.getByLabelText("In progress"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Your settings have been saved.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/settings/notifications", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "uma@example.com",
        emailEnabled: true,
        emailStatuses: ["IN_PROGRESS", "RESOLVED"]
      })
    });
    expect(screen.getByLabelText("Email address")).toHaveValue("uma@example.com");

    fireEvent.click(screen.getByLabelText("Under review"));

    expect(screen.queryByText("Your settings have been saved.")).not.toBeInTheDocument();
  });

  it("shows a server rejection without losing the form", async () => {
    stubSettings(defaultSettings, () =>
      jsonResponse({ error: { code: "VALIDATION_ERROR", message: "invalid" } }, 400)
    );
    render(<SettingsPage session={session} />);

    fireEvent.change(await screen.findByLabelText("Email address"), {
      target: { value: "uma@example" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your email address and selected statuses."
    );
    expect(screen.getByLabelText("Email address")).toHaveValue("uma@example");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled()
    );
  });

  it("shows an error when settings cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
    );
    render(<SettingsPage session={session} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your settings");
  });
});
