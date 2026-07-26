import { describe, expect, it } from "vitest";
import { makeLeave, makeUser } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

describe("GET /calendar", () => {
  it("a member CAN call it, and responses never contain reason/decisionNote", async () => {
    const member = await makeUser({ displayName: "Bob" });
    const other = await makeUser({ displayName: "Carol" });
    const { app, tokenFor } = await buildTestApp([member, other]);

    await makeLeave({
      userId: other.id,
      start: "2025-06-01",
      end: "2025-06-03",
      status: "approved",
      reason: "secret family matter",
    });

    const res = await app.inject({
      method: "GET",
      url: "/calendar?from=2025-05-01&to=2025-07-01",
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).not.toHaveProperty("reason");
      expect(row).not.toHaveProperty("decisionNote");
      expect(row.status).toBe("approved");
      expect(row.userDisplayName).toBe("Carol");
      expect(typeof row.id).toBe("string");
    }
  });

  it("pending/rejected/cancelled leave is excluded", async () => {
    const member = await makeUser({});
    const { app, tokenFor } = await buildTestApp([member]);
    await makeLeave({
      userId: member.id,
      start: "2025-06-01",
      end: "2025-06-03",
      status: "pending",
    });
    const res = await app.inject({
      method: "GET",
      url: "/calendar?from=2025-05-01&to=2025-07-01",
      headers: bearer(tokenFor(member)),
    });
    expect(res.json()).toEqual([]);
  });
});
