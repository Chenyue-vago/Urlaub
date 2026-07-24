import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth/context.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { createLeave, cancelLeave, decideLeave, hideLeaveGroup } from "../services/leave.js";
import { listLeaveRequests, getLeaveGroupByRowId } from "../services/queries.js";
import { toLeaveRequestDTO } from "../lib/serialize.js";

const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  userId: z.string().optional(),
});

const createBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
  userId: z.string().optional(),
});

const rejectBodySchema = z.object({
  note: z.string().min(1),
});

export async function leaveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/leave-requests", { preHandler: requireAuth }, async (req) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const { year, userId } = parsed.data;

    // Scope resolution. The default is SAFE — you only ever see your own rows —
    // so an admin's personal dashboard (no userId) never leaks other employees'
    // leave. Admins opt into the cross-user view explicitly:
    //   userId=all        -> every user's rows (the approvals queue)
    //   userId=<someId>   -> that user's rows
    //   (omitted)         -> the caller's own rows
    // Members are always pinned to themselves regardless of what they pass.
    let targetUserId: string | undefined;
    if (req.user!.role === "admin") {
      if (userId === "all") targetUserId = undefined; // no filter => all users
      else targetUserId = userId ?? req.user!.id;
    } else {
      targetUserId = req.user!.id;
    }

    const rows = await listLeaveRequests({ userId: targetUserId, year });
    return rows.map(toLeaveRequestDTO);
  });

  app.post("/leave-requests", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const { startDate, endDate, reason, userId } = parsed.data;

    if (req.user!.role !== "admin" && userId && userId !== req.user!.id) {
      throw forbidden();
    }

    const targetUserId = req.user!.role === "admin" ? userId : req.user!.id;

    const rows = await createLeave({
      actor: { id: req.user!.id, role: req.user!.role },
      targetUserId,
      startDate,
      endDate,
      reason,
    });
    reply.status(201);
    return rows.map(toLeaveRequestDTO);
  });

  app.get("/leave-requests/:id", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const found = await getLeaveGroupByRowId(id);
    if (!found) throw notFound("leave_not_found");
    const { row, group } = found;
    if (req.user!.role !== "admin" && row.userId !== req.user!.id) {
      throw forbidden();
    }
    return { ...toLeaveRequestDTO(row), group: group.map(toLeaveRequestDTO) };
  });

  app.post("/leave-requests/:id/cancel", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const found = await getLeaveGroupByRowId(id);
    if (!found) throw notFound("leave_not_found");
    const rows = await cancelLeave({
      actor: { id: req.user!.id, role: req.user!.role },
      groupId: found.row.groupId,
    });
    return rows.map(toLeaveRequestDTO);
  });

  // Soft-hide a cancelled group from the owner's own dashboard (row stays for
  // balance history + audit; see hideLeaveGroup for the owner/cancelled guards).
  app.post("/leave-requests/:id/hide", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const found = await getLeaveGroupByRowId(id);
    if (!found) throw notFound("leave_not_found");
    const rows = await hideLeaveGroup({
      actor: { id: req.user!.id, role: req.user!.role },
      groupId: found.row.groupId,
    });
    return rows.map(toLeaveRequestDTO);
  });

  app.post(
    "/leave-requests/:id/approve",
    { preHandler: [requireAuth, requireAdmin] },
    async (req) => {
      const { id } = req.params as { id: string };
      const found = await getLeaveGroupByRowId(id);
      if (!found) throw notFound("leave_not_found");
      const rows = await decideLeave({
        actor: { id: req.user!.id, role: req.user!.role },
        groupId: found.row.groupId,
        action: "approve",
      });
      return rows.map(toLeaveRequestDTO);
    }
  );

  app.post(
    "/leave-requests/:id/reject",
    { preHandler: [requireAuth, requireAdmin] },
    async (req) => {
      const parsed = rejectBodySchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
      const { id } = req.params as { id: string };
      const found = await getLeaveGroupByRowId(id);
      if (!found) throw notFound("leave_not_found");
      const rows = await decideLeave({
        actor: { id: req.user!.id, role: req.user!.role },
        groupId: found.row.groupId,
        action: "reject",
        note: parsed.data.note,
      });
      return rows.map(toLeaveRequestDTO);
    }
  );
}
