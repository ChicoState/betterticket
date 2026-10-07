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
        additionalInformation: "Started after an update."
      })
    });
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
