import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

// `code` doubles as the i18n key the frontend uses to look up a localized
// message (spec §11), so defaulting `message` to `code` here is intentional —
// callers that only pass a code still get a usable (if untranslated) message.
export function badRequest(code: string, message = code): AppError {
  return new AppError(message, code, 400);
}

export function forbidden(code = "forbidden", message = code): AppError {
  return new AppError(message, code, 403);
}

export function notFound(code = "not_found", message = code): AppError {
  return new AppError(message, code, 404);
}

export function conflict(code: string, message = code): AppError {
  return new AppError(message, code, 409);
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof AppError) {
      reply.status(err.status).send({ error: err.message, code: err.code });
      return;
    }

    app.log.error(err);
    reply.status(500).send({ error: "Internal Server Error", code: "internal" });
  });
}
