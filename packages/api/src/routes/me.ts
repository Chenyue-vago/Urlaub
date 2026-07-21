import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/context.js";
import { badRequest } from "../lib/errors.js";
import { toMeDTO } from "../lib/serialize.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const patchMeSchema = z.object({
  region: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  employmentStartDate: z
    .union([z.string().regex(ISO_DATE), z.null()])
    .optional(),
});

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: requireAuth }, async (req) => {
    return toMeDTO(req.user!);
  });

  app.patch("/me", { preHandler: requireAuth }, async (req) => {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("validation_error", parsed.error.message);
    const { region, displayName, employmentStartDate } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(region !== undefined ? { region } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(employmentStartDate !== undefined
          ? {
              employmentStartDate:
                employmentStartDate === null
                  ? null
                  : new Date(`${employmentStartDate}T00:00:00.000Z`),
            }
          : {}),
      },
    });

    return toMeDTO(updated);
  });
}
