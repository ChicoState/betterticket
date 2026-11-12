import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TicketForm } from "./TicketForm.js";

const ticketResponse = {
  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  title: "Laptop will not start",
  description: "The power light flashes once.",
  setup: "Framework Laptop 13, Fedora 42",
  additionalInformation: "Started after an update.",
  status: "OPEN",
  createdAt: "2026-09-28T18:00:00.000Z",
  updatedAt: "2026-09-28T18:00:00.000Z"
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Laptop will not start" }
  });
  fireEvent.change(screen.getByLabelText("What is happening?"), {
    target: { value: "The power light flashes once." }
  });
  fireEvent.change(screen.getByLabelText("Your setup"), {
    target: { value: "Framework Laptop 13, Fedora 42" }
  });
}

describe("TicketForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("submits the approved ticket fields and shows confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ticketResponse), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Additional information"), {
      target: { value: "Started after an update." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByText("Your ticket has been created.")).toBeInTheDocument();
    expect(screen.getByText("cc04d84c")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View ticket" })).toHaveAttribute(
      "href",
      "/tickets/cc04d84c-9aee-4d35-8af3-999d861aaed6"
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        priority: "MEDIUM",
        additionalInformation: "Started after an update.",
        visibility: "PUBLIC"
      })
    });
  });

  it.each(["LOW", "MEDIUM", "HIGH"] as const)("submits %s priority", async (priority) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(ticketResponse), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketForm />);

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: priority } });
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await screen.findByText("Your ticket has been created.");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({ priority });
  });

  it("disables duplicate submission while the request is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketForm />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Creating ticket…"
    });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRequest?.(
      new Response(JSON.stringify(ticketResponse), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    await screen.findByText("Your ticket has been created.");
  });

  it("lets a signed-in user choose anonymous posting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ticketResponse), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TicketForm
        currentUser={{
          id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
          name: "Uma User",
          username: "uma",
          role: "USER"
        }}
      />
    );

    fillRequiredFields();
    fireEvent.click(screen.getByLabelText("Post anonymously"));
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await screen.findByText("Your ticket has been created.");
    expect(fetchMock).toHaveBeenCalledWith("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        priority: "MEDIUM",
        visibility: "PUBLIC",
        postAnonymously: true
      })
    });
  });

  it("lets a signed-in user select an attachment and submits multipart data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(ticketResponse), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TicketForm
        currentUser={{
          id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
          name: "Uma User",
          username: "uma",
          role: "USER"
        }}
      />
    );

    fillRequiredFields();
    const file = new File([new Uint8Array([1, 2, 3])], "screen.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [file] } });

    expect(screen.getByText("screen.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await screen.findByText("Your ticket has been created.");
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/tickets");
    expect(request?.[1]?.method).toBe("POST");
    expect(request?.[1]?.headers).toBeUndefined();
    expect(request?.[1]?.body).toBeInstanceOf(FormData);
    expect((request?.[1]?.body as FormData).getAll("attachments")).toEqual([file]);
  });

  it("accepts dropped files and lets the user remove them", () => {
    render(
      <TicketForm
        currentUser={{
          id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
          name: "Uma User",
          username: "uma",
          role: "USER"
        }}
      />
    );
    const file = new File([new Uint8Array([1, 2, 3])], "dropped.png", {
      type: "image/png"
    });

    fireEvent.drop(screen.getByText("Drop files here or").parentElement as HTMLElement, {
      dataTransfer: { files: [file] }
    });

    expect(screen.getByText("dropped.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove dropped.png" }));
    expect(screen.queryByText("dropped.png")).not.toBeInTheDocument();
  });

  it("tells anonymous visitors to sign in before attaching files", () => {
    render(<TicketForm />);

    expect(screen.getByText(/Sign in to attach screenshots or other files/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose files")).not.toBeInTheDocument();
  });

  it("shows an accessible error and keeps the entered values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "INTERNAL_ERROR",
              message: "The ticket request could not be completed"
            }
          }),
          { status: 500, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(<TicketForm />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create your ticket. Please try again."
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Laptop will not start");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create ticket" })).toBeEnabled()
    );
  });
});
