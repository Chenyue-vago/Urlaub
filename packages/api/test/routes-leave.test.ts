import { describe, expect, it } from "vitest";
import { makeUser, prisma } from "./helpers/factories.js";
import { buildTestApp, bearer } from "./helpers/app.js";

describe("leave-requests routes", () => {
  it("member GET /leave-requests returns only own rows; passing another userId does not leak others", async () => {
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const other = await makeUser({ employmentStartDate: "2025-01-01" });
    const { app, tokenFor } = await buildTestApp([member, other]);

    await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(member)),
      payload: { startDate: "2025-03-04", endDate: "2025-03-05", type: "statutory" },
    });
    await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(other)),
      payload: { startDate: "2025-04-04", endDate: "2025-04-05", type: "statutory" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/leave-requests?userId=${other.id}`,
      headers: bearer(tokenFor(member)),
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(rows.every((r: any) => r.userId === member.id)).toBe(true);
    expect(rows.length).toBe(1);
  });

  it("member POST creates pending; admin POST with userId creates approved for that user", async () => {
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const memberRes = await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(member)),
      payload: { startDate: "2025-03-04", endDate: "2025-03-05", type: "statutory" },
    });
    expect(memberRes.statusCode).toBe(201);
    expect(memberRes.json()[0].status).toBe("pending");

    const adminRes = await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(admin)),
      payload: {
        startDate: "2025-05-05",
        endDate: "2025-05-06",
        type: "statutory",
        userId: member.id,
      },
    });
    expect(adminRes.statusCode).toBe(201);
    expect(adminRes.json()[0].status).toBe("approved");
    expect(adminRes.json()[0].userId).toBe(member.id);
  });

  it("member approve/reject -> 403; admin approve works; admin reject without note -> 400", async () => {
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([member, admin]);

    const created = await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(member)),
      payload: { startDate: "2025-03-04", endDate: "2025-03-05", type: "statutory" },
    });
    const id = created.json()[0].id;

    const memberApprove = await app.inject({
      method: "POST",
      url: `/leave-requests/${id}/approve`,
      headers: bearer(tokenFor(member)),
    });
    expect(memberApprove.statusCode).toBe(403);

    const adminRejectNoNote = await app.inject({
      method: "POST",
      url: `/leave-requests/${id}/reject`,
      headers: bearer(tokenFor(admin)),
      payload: {},
    });
    expect(adminRejectNoNote.statusCode).toBe(400);

    const adminApprove = await app.inject({
      method: "POST",
      url: `/leave-requests/${id}/approve`,
      headers: bearer(tokenFor(admin)),
    });
    expect(adminApprove.statusCode).toBe(200);
    expect(adminApprove.json()[0].status).toBe("approved");
  });

  it("GET /leave-requests/:id: owner ok, other member forbidden, admin ok", async () => {
    const owner = await makeUser({ employmentStartDate: "2025-01-01" });
    const other = await makeUser({});
    const admin = await makeUser({ role: "admin" });
    const { app, tokenFor } = await buildTestApp([owner, other, admin]);

    const created = await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(owner)),
      payload: { startDate: "2025-03-04", endDate: "2025-03-05", type: "statutory" },
    });
    const id = created.json()[0].id;

    const ownerRes = await app.inject({
      method: "GET",
      url: `/leave-requests/${id}`,
      headers: bearer(tokenFor(owner)),
    });
    expect(ownerRes.statusCode).toBe(200);

    const otherRes = await app.inject({
      method: "GET",
      url: `/leave-requests/${id}`,
      headers: bearer(tokenFor(other)),
    });
    expect(otherRes.statusCode).toBe(403);

    const adminRes = await app.inject({
      method: "GET",
      url: `/leave-requests/${id}`,
      headers: bearer(tokenFor(admin)),
    });
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.json().group.length).toBeGreaterThan(0);
  });

  it("member can cancel own leave", async () => {
    const member = await makeUser({ employmentStartDate: "2025-01-01" });
    const { app, tokenFor } = await buildTestApp([member]);
    const created = await app.inject({
      method: "POST",
      url: "/leave-requests",
      headers: bearer(tokenFor(member)),
      payload: { startDate: "2099-03-04", endDate: "2099-03-05", type: "statutory" },
    });
    const id = created.json()[0].id;
    const cancelRes = await app.inject({
      method: "POST",
      url: `/leave-requests/${id}/cancel`,
      headers: bearer(tokenFor(member)),
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json()[0].status).toBe("cancelled");
  });
});
