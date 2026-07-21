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
