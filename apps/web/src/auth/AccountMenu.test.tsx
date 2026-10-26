import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows the signed-in user's name on the menu button", () => {
    render(<AccountMenu session={{ type: "authenticated", user }} onLogout={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Account: Signed in as Uma User" })
    ).toHaveTextContent("Uma User");
  });

  it("shows the signed-in identity and logs out", async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(<AccountMenu session={{ type: "authenticated", user }} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Account: Signed in as Uma User" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
    const options = screen.getByLabelText("Account options");
    expect(within(options).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(within(options).getByText("Uma User")).toBeInTheDocument();
    expect(within(options).getByText("@uma")).toBeInTheDocument();
  });

  it("keeps the menu available when logout fails", async () => {
    const onLogout = vi.fn().mockRejectedValue(new Error("offline"));
    render(<AccountMenu session={{ type: "authenticated", user }} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Account: Signed in as Uma User" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't log you out.");
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });

  it("labels a signed-in technician as an IT account", () => {
    const { container } = render(
      <AccountMenu
        session={{ type: "authenticated", user: { ...user, role: "TECHNICIAN" } }}
        onLogout={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Account: Signed in as Uma User (IT)" })
    ).toBeInTheDocument();
    expect(container.querySelector(".account-it-badge")).toHaveTextContent("IT");
  });

  it.each([
    ["a regular user", { type: "authenticated" as const, user }],
    ["an anonymous visitor", { type: "anonymous" as const }]
  ])("does not show the IT badge to %s", (_name, session) => {
    const { container } = render(<AccountMenu session={session} onLogout={vi.fn()} />);

    expect(container.querySelector(".account-it-badge")).toBeNull();
  });
});
