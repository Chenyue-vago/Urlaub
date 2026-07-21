import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApi, ApiError } from "../lib/api";
import {
  listLeaveRequests,
  createLeaveRequest,
  getLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "./leave";

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

describe("leave service", () => {
  it("listLeaveRequests sends GET /leave-requests with year and userId query params", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse([]));
    const api = createApi(async () => "tok");
    await listLeaveRequests(api, { year: 2026, userId: "u1" });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toContain("/leave-requests");
    expect(parsed.searchParams.get("year")).toBe("2026");
    expect(parsed.searchParams.get("userId")).toBe("u1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("createLeaveRequest sends POST /leave-requests with JSON body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse([{ id: "lr1", status: "pending" }], 201)
    );
    const api = createApi(async () => "tok");
    const payload = { startDate: "2026-03-04", endDate: "2026-03-05", type: "statutory" as const };
    const result = await createLeaveRequest(api, payload);

    expect(result).toEqual([{ id: "lr1", status: "pending" }]);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/leave-requests");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it("createLeaveRequest maps 409 insufficient balance to ApiError with matching code", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ error: "Insufficient balance", code: "insufficient_balance" }, 409)
    );
    const api = createApi(async () => "tok");
    const payload = { startDate: "2026-03-04", endDate: "2026-03-05", type: "statutory" as const };

    await expect(createLeaveRequest(api, payload)).rejects.toBeInstanceOf(ApiError);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ error: "Insufficient balance", code: "insufficient_balance" }, 409)
    );
    await expect(createLeaveRequest(api, payload)).rejects.toMatchObject({
      code: "insufficient_balance",
    });
  });

  it("getLeaveRequest sends GET /leave-requests/:id", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ id: "lr1" }));
    const api = createApi(async () => "tok");
    await getLeaveRequest(api, "lr1");
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/leave-requests/lr1");
    expect(init.method).toBe("GET");
  });

  it("cancelLeaveRequest sends POST /leave-requests/:id/cancel", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ id: "lr1" }));
    const api = createApi(async () => "tok");
    await cancelLeaveRequest(api, "lr1");
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/leave-requests/lr1/cancel");
    expect(init.method).toBe("POST");
  });

  it("approveLeaveRequest sends POST /leave-requests/:id/approve", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ id: "lr1" }));
    const api = createApi(async () => "tok");
    await approveLeaveRequest(api, "lr1");
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/leave-requests/lr1/approve");
    expect(init.method).toBe("POST");
  });

  it("rejectLeaveRequest sends POST /leave-requests/:id/reject with note body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({ id: "lr1" }));
    const api = createApi(async () => "tok");
    await rejectLeaveRequest(api, "lr1", "not enough coverage");
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/leave-requests/lr1/reject");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ note: "not enough coverage" });
  });
});
