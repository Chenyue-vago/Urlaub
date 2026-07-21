import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/context.js";
import { badRequest } from "../lib/errors.js";
import { listCalendar } from "../services/queries.js";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Team timeline: approved leave across ALL users. Any authenticated user
 * may view it — it is intentionally NOT admin-only. Never exposes `reason` or
 * `decisionNote`. */
export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  app.get("/calendar", { preHandler: requireAuth }, async (req) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const from = new Date(`${parsed.data.from}T00:00:00.000Z`);
    const to = new Date(`${parsed.data.to}T00:00:00.000Z`);
    return listCalendar(from, to);
  });
}
