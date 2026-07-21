import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApi } from "../lib/api";
import { getBalance } from "./balance";

beforeEach(() => {
  global.fetch = vi.fn();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("balance service", () => {
  it("getBalance sends GET /balance with year and userId query params", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ year: 2026, statutoryRemaining: 10 })
    );
    const api = createApi(async () => "tok");
    const result = await getBalance(api, { year: 2026, userId: "u1" });

    expect(result).toEqual({ year: 2026, statutoryRemaining: 10 });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toContain("/balance");
    expect(parsed.searchParams.get("year")).toBe("2026");
    expect(parsed.searchParams.get("userId")).toBe("u1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });
});
