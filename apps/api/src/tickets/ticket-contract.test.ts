import { describe, expect, it } from "vitest";

import { parseTicketSearch, ticketSearchMaxTerms } from "./ticket-contract.js";

describe("parseTicketSearch", () => {
  it.each([undefined, "", "   ", "\n\t"])("treats %j as no search", (q) => {
    expect(parseTicketSearch(q)).toBeNull();
    expect(parseTicketSearch(q, "any")).toBeNull();
  });

  it("splits on whitespace, folds case, and drops duplicate terms", () => {
    expect(parseTicketSearch("  Printer  OFFLINE\tprinter ")).toEqual({
      terms: ["printer", "offline"],
      match: "all"
    });
  });

  it("keeps short and common words when every term must match", () => {
    expect(parseTicketSearch("the pc is not on")).toEqual({
      terms: ["the", "pc", "is", "not", "on"],
      match: "all"
    });
  });

  it("drops short and common words when looking for similar tickets", () => {
    expect(parseTicketSearch("The printer is not on Wi-Fi", "any")).toEqual({
      terms: ["printer", "wi-fi"],
      match: "any"
    });
  });

  it("returns no terms when a similar-ticket search has only short or common words", () => {
    expect(parseTicketSearch("it is not on", "any")).toEqual({ terms: [], match: "any" });
  });

  it("uses only the first distinct terms up to the cap", () => {
    const words = Array.from({ length: ticketSearchMaxTerms + 4 }, (_, index) => `word${index}`);

    expect(parseTicketSearch(words.join(" "))?.terms).toEqual(words.slice(0, ticketSearchMaxTerms));
    expect(parseTicketSearch(`the and ${words.join(" ")}`, "any")?.terms).toEqual(
      words.slice(0, ticketSearchMaxTerms)
    );
  });
});
