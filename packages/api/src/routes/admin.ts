import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth/context.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../db.js";
import type { AuditLogPageDTO } from "@urlaub/shared";
import { toAuditLogEntryDTO } from "../lib/serialize.js";
import {
  countActiveAdmins,
  listAuditLog,
  listUsersWithUsage,
} from "../services/queries.js";

const ALLOWED_DOMAIN = "@vago-solutions.ai";

const inviteBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).optional(),
});

const patchUserBodySchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  isActive: z.boolean().optional(),
});

const patchSettingsBodySchema = z.object({
  statutoryDays: z.number().int().positive().optional(),
  contractualDays: z.number().int().nonnegative().optional(),
  carryOverDeadline: z
    .string()
    .regex(/^\d{2}-\d{2}$/)
    .optional(),
});

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/users", { preHandler: [requireAuth, requireAdmin] }, async () => {
    const year = new Date().getFullYear();
    return listUsersWithUsage(year);
  });

  app.post(
    "/admin/users/invite",
    { preHandler: [requireAuth, requireAdmin] },
    async (req) => {
      const parsed = inviteBodySchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
      const { email, role } = parsed.data;

      if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
        throw badRequest("email_domain_not_allowed");
      }

      // Deliberately no local `users` row is created here — see the comment
      // on ClerkInviter (src/auth/inviter.ts) for the reasoning: clerkId is
      // unknown until first login, at which point resolveUser creates the
      // row as `member`; an admin promotes via PATCH afterwards.
      await req.server.inviter.invite(email, { role });

      return { invited: email };
    }
  );

  app.patch(
    "/admin/users/:id",
    { preHandler: [requireAuth, requireAdmin] },
    async (req) => {
      const parsed = patchUserBodySchema.safeParse(req.body);
      if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
      const { id } = req.params as { id: string };
      const { role, isActive } = parsed.data;

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) throw notFound("user_not_found");

      const demotingAdmin = role === "member" && target.role === "admin";
      const deactivating = isActive === false && target.isActive === true;

      if (target.role === "admin" && target.isActive && (demotingAdmin || deactivating)) {
        const activeAdmins = await countActiveAdmins();
        if (activeAdmins <= 1) {
          throw new AppError("Cannot remove the last admin", "last_admin", 409);
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.user.update({
          where: { id },
          data: {
            ...(role !== undefined ? { role } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });

        if (role !== undefined && role !== target.role) {
          await tx.auditLog.create({
            data: {
              actorId: req.user!.id,
              action: "change_role",
              targetType: "user",
              targetId: id,
              metadata: { from: target.role, to: role },
            },
          });
        }

        if (isActive !== undefined && isActive !== target.isActive) {
          await tx.auditLog.create({
            data: {
              actorId: req.user!.id,
              action: isActive ? "activate_user" : "deactivate_user",
              targetType: "user",
              targetId: id,
              metadata: { from: target.isActive, to: isActive },
            },
          });
        }

        return row;
      });

      return updated;
    }
  );

  app.get("/settings", { preHandler: requireAuth }, async () => {
    return prisma.appSettings.findUnique({ where: { id: 1 } });
  });

  app.patch("/settings", { preHandler: [requireAuth, requireAdmin] }, async (req) => {
    const parsed = patchSettingsBodySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const data = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appSettings.update({ where: { id: 1 }, data });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "update_settings",
          targetType: "app_settings",
          targetId: "1",
          metadata: data,
        },
      });
      return row;
    });

    return updated;
  });

  app.get(
    "/admin/audit-log",
    { preHandler: [requireAuth, requireAdmin] },
    async (req) => {
      const parsed = auditLogQuerySchema.safeParse(req.query);
      if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
      const { limit = 50, cursor } = parsed.data;
      const { rows, nextCursor } = await listAuditLog({ limit, cursor });
      const page: AuditLogPageDTO = {
        items: rows.map(toAuditLogEntryDTO),
        nextCursor: nextCursor ?? null,
      };
      return page;
    }
  );
}
