import "./env-test.js"; // side-effect: point DATABASE_URL at test DB first
import { afterAll, beforeEach } from "vitest";
import { prisma, resetDb, makeSettings } from "./factories.js";

// Fresh state before every test: empty tables + the single default settings row.
beforeEach(async () => {
  await resetDb();
  await makeSettings();
});

afterAll(async () => {
  await prisma.$disconnect();
});
