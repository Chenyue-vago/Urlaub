import { execSync } from "node:child_process";

// Runs once before the whole suite, in its own process. Point Prisma at the
// test DB and ensure its schema is up to date via `prisma migrate deploy`.
export default function setup() {
  try {
    process.loadEnvFile();
  } catch {
    // ignore
  }

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL is required to run the API test suite");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
