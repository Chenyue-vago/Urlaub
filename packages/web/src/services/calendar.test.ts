import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApi } from "../lib/api";
import { getCalendar } from "./calendar";

beforeEach(() => {
  global.fetch = vi.fn();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("calendar service", () => {
  it("getCalendar sends GET /calendar with from and to query params", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse([]));
    const api = createApi(async () => "tok");
    await getCalendar(api, { from: "2026-01-01", to: "2026-12-31" });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toContain("/calendar");
    expect(parsed.searchParams.get("from")).toBe("2026-01-01");
    expect(parsed.searchParams.get("to")).toBe("2026-12-31");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });
});
