import { describe, expect, test } from "vitest";
import { parseAllowedDomains, isEmailAllowed } from "../src/auth/context.js";

describe("parseAllowedDomains", () => {
  test("splits a comma-separated list, trims, lowercases, strips leading @", () => {
    expect(parseAllowedDomains("vago-solutions.ai, @Gmail.com ,  Example.COM")).toEqual([
      "vago-solutions.ai",
      "gmail.com",
      "example.com",
    ]);
  });

  test("drops empty entries", () => {
    expect(parseAllowedDomains("vago-solutions.ai,,")).toEqual(["vago-solutions.ai"]);
    expect(parseAllowedDomains("")).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  const domains = ["vago-solutions.ai", "gmail.com"];

  test("accepts an email in any configured domain", () => {
    expect(isEmailAllowed("dev@vago-solutions.ai", domains)).toBe(true);
    expect(isEmailAllowed("chenyueyoli@gmail.com", domains)).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isEmailAllowed("Dev.Case@VAGO-SOLUTIONS.AI", domains)).toBe(true);
  });

  test("rejects an email outside every configured domain", () => {
    expect(isEmailAllowed("x@example.com", domains)).toBe(false);
  });

  test("the @ anchor prevents suffix spoofing", () => {
    // Ends with the domain text but not at an @ boundary — must be rejected.
    expect(isEmailAllowed("x@notgmail.com", domains)).toBe(false);
    expect(isEmailAllowed("x@evil-vago-solutions.ai", domains)).toBe(false);
  });

  test("empty allowlist rejects everything (fail closed)", () => {
    expect(isEmailAllowed("dev@vago-solutions.ai", [])).toBe(false);
  });
});
