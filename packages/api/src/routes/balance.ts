import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/context.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { getBalance, type Balance } from "../services/balance.js";
import { prisma } from "../db.js";
import type { YearlyVacationStats } from "@urlaub/shared";

const querySchema = z.object({
  year: z.coerce.number().int().optional(),
  userId: z.string().optional(),
});

export async function balanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/balance", { preHandler: requireAuth }, async (req) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const { year, userId } = parsed.data;

    let targetUserId: string;
    if (req.user!.role === "admin") {
      targetUserId = userId ?? req.user!.id;
    } else {
      if (userId && userId !== req.user!.id) throw forbidden();
      targetUserId = req.user!.id;
    }

    const targetYear = year ?? new Date().getFullYear();
    const balance = await getBalance(prisma, targetUserId, targetYear);
    return toYearlyVacationStats(balance);
  });
}

/**
 * Map the service's internal Balance to the shared flat YearlyVacationStats —
 * the contract the web client (StatsCards) consumes. `total` is the base yearly
 * entitlement; carried-over days are reported separately and added into
 * `remaining`. The backend does not model carry-over expiry, so
 * carryOverExpired is 0.
 */
function toYearlyVacationStats(b: Balance): YearlyVacationStats {
  return {
    year: b.year,
    total: b.total,
    used: b.used,
    remaining: b.available,
    carryOver: b.carryOver,
    carryOverUsed: Math.min(b.carryOver, b.used),
    carryOverExpired: 0,
  };
}
