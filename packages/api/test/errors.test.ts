import { expect, test } from "vitest";
import { buildServer } from "../src/server";
import { AppError } from "../src/lib/errors";

test("AppError produces its status code and code in the JSON body", async () => {
  const app = buildServer();
  app.get("/__test/app-error", async () => {
    throw new AppError("Balance exceeded", "balance_exceeded", 409);
  });

  const res = await app.inject({ method: "GET", url: "/__test/app-error" });

  expect(res.statusCode).toBe(409);
  expect(res.json()).toEqual({ error: "Balance exceeded", code: "balance_exceeded" });
});

test("unexpected errors are masked as a generic 500 and do not leak internals", async () => {
  const app = buildServer();
  app.get("/__test/boom", async () => {
    throw new Error("boom");
  });

  const res = await app.inject({ method: "GET", url: "/__test/boom" });

  expect(res.statusCode).toBe(500);
  expect(res.json()).toEqual({ error: "Internal Server Error", code: "internal" });
  expect(res.payload).not.toContain("boom");
});
