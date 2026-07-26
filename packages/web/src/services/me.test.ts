import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApi } from "../lib/api";
import { ApiError } from "../lib/api";
import { getMe, updateMe } from "./me";

beforeEach(() => {
  global.fetch = vi.fn();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("me service", () => {
  it("getMe sends GET /me with bearer token", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ id: "u1", email: "a@b.com" })
    );
    const api = createApi(async () => "token-123");
    const result = await getMe(api);

    expect(result).toEqual({ id: "u1", email: "a@b.com" });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/me");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("updateMe sends PATCH /me with JSON body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ id: "u1", region: "BY" })
    );
    const api = createApi(async () => "token-abc");
    const result = await updateMe(api, { region: "BY" });

    expect(result).toEqual({ id: "u1", region: "BY" });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ region: "BY" });
    expect(init.headers.Authorization).toBe("Bearer token-abc");
  });

  it("maps non-2xx {error, code} to ApiError", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ error: "Not found", code: "not_found" }, 404)
    );
    const api = createApi(async () => null);
    await expect(getMe(api)).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
    await expect(getMe(api)).rejects.toBeInstanceOf(ApiError);
  });
});
