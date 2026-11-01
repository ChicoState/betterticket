import { describe, expect, it } from "vitest";

import { parseUserRole } from "./auth-contract.js";

describe("parseUserRole", () => {
  it.each([
    ["USER", "USER"],
    [" technician ", "TECHNICIAN"]
  ])("accepts %j", (input, expected) => {
    expect(parseUserRole(input)).toBe(expected);
  });

  it.each(["", "ADMIN", "IT"])("rejects %j", (input) => {
    expect(() => parseUserRole(input)).toThrow("Role must be USER or TECHNICIAN");
  });
});
