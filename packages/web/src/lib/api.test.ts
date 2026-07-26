import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApi } from "./api";

describe("createApi success body handling", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves undefined for a 2xx response with an empty/non-JSON body instead of throwing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);

    const api = createApi(async () => null);
    await expect(api.apiFetch("/leave-requests/1/cancel", { method: "POST" })).resolves.toBeUndefined();
  });

  it("omits Content-Type on a bodyless request (empty JSON body breaks the server)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);

    const api = createApi(async () => null);
    await api.apiFetch("/leave-requests/1/approve", { method: "POST" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("sets Content-Type when a body is present", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);

    const api = createApi(async () => null);
    await api.apiFetch("/leave-requests/1/reject", { method: "POST", body: { note: "no" } });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ note: "no" });
  });
});

describe("createApi base URL handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when VITE_API_URL is unset", () => {
    vi.stubEnv("VITE_API_URL", "");

    expect(() => createApi(async () => null)).toThrowError(/VITE_API_URL is not set/);
  });

  it("does not throw an Invalid URL error when VITE_API_URL is unset", () => {
    vi.stubEnv("VITE_API_URL", "");

    try {
      createApi(async () => null);
      throw new Error("expected createApi to throw");
    } catch (err) {
      expect((err as Error).message).not.toMatch(/Invalid URL/);
    }
  });
});
