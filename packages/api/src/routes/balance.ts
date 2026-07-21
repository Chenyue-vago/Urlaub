import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/context.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { getBalance } from "../services/balance.js";
import { prisma } from "../db.js";

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
    return getBalance(prisma, targetUserId, targetYear);
  });
}
