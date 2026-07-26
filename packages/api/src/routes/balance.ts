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
 * Map the service's internal nested Balance to the shared flat
 * YearlyVacationStats — the contract the web client (StatsCards) consumes.
 * `statutoryTotal` includes carried-over days, matching the shared math.
 * The backend does not model carry-over expiry, so carryOverExpired is 0.
 */
function toYearlyVacationStats(b: Balance): YearlyVacationStats {
  return {
    year: b.year,
    statutoryTotal: b.statutory.total + b.statutory.carryOver,
    contractualTotal: b.contractual.total,
    statutoryUsed: b.statutory.used,
    contractualUsed: b.contractual.used,
    statutoryRemaining: b.statutory.available,
    contractualRemaining: b.contractual.available,
    carryOver: b.statutory.carryOver,
    carryOverUsed: Math.min(b.statutory.carryOver, b.statutory.used),
    carryOverExpired: 0,
  };
}
