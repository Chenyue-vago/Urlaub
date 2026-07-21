import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApi } from "../lib/api";
import {
  listUsers,
  inviteUser,
  updateUser,
  getSettings,
  updateSettings,
  getAuditLog,
} from "./admin";

beforeEach(() => {
  global.fetch = vi.fn();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("admin service", () => {
  it("listUsers sends GET /admin/users", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse([]));
    const api = createApi(async () => "tok");
    await listUsers(api);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/admin/users");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("inviteUser sends POST /admin/users/invite with JSON body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ id: "u2" }, 201)
    );
    const api = createApi(async () => "tok");
    await inviteUser(api, { email: "new@x.com", role: "member" });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/admin/users/invite");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "new@x.com", role: "member" });
  });

  it("updateUser sends PATCH /admin/users/:id with JSON body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ id: "u2" }));
    const api = createApi(async () => "tok");
    await updateUser(api, "u2", { role: "admin", isActive: false });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/admin/users/u2");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ role: "admin", isActive: false });
  });

  it("getSettings sends GET /settings", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ statutoryDays: 20 })
    );
    const api = createApi(async () => "tok");
    await getSettings(api);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/settings");
    expect(init.method).toBe("GET");
  });

  it("updateSettings sends PATCH /settings with JSON body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ statutoryDays: 22 })
    );
    const api = createApi(async () => "tok");
    await updateSettings(api, { statutoryDays: 22 });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/settings");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ statutoryDays: 22 });
  });

  it("getAuditLog sends GET /admin/audit-log with limit and cursor query params", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ items: [] }));
    const api = createApi(async () => "tok");
    await getAuditLog(api, { limit: 50, cursor: "abc" });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toContain("/admin/audit-log");
    expect(parsed.searchParams.get("limit")).toBe("50");
    expect(parsed.searchParams.get("cursor")).toBe("abc");
    expect(init.method).toBe("GET");
  });
});
