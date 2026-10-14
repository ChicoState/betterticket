import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./AccountMenu.js";

const user = {
  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  name: "Uma User",
  username: "uma",
  role: "USER" as const
};

describe("AccountMenu", () => {
  afterEach(() => cleanup());

  it("shows an anonymous visitor a sign-in action", () => {
    render(<AccountMenu session={{ type: "anonymous" }} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Account: Anonymous" }));

    expect(screen.getByLabelText("Account options")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Settings (coming soon)" })).toBeDisabled();
  });

  it("shows the signed-in identity and logs out", async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(<AccountMenu session={{ type: "authenticated", user }} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Account: Signed in as Uma User" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
    expect(screen.getByText("Uma User")).toBeInTheDocument();
    expect(screen.getByText("@uma")).toBeInTheDocument();
  });

  it("keeps the menu available when logout fails", async () => {
    const onLogout = vi.fn().mockRejectedValue(new Error("offline"));
    render(<AccountMenu session={{ type: "authenticated", user }} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Account: Signed in as Uma User" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't log you out.");
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });
});
