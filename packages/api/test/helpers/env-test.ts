// MUST be imported before anything that constructs a PrismaClient (src/db.ts).
// ESM evaluates imports in source order, so importing this module first
// guarantees DATABASE_URL points at the test database before Prisma reads it.
try {
  process.loadEnvFile();
} catch {
  // no .env — rely on already-set env vars (e.g. CI)
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is required to run the API test suite (see packages/api/.env)"
  );
}

// Redirect the app's Prisma client at the isolated test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Pin the email allowlist to the default company domain so the suite is
// deterministic regardless of any relaxed local .env (e.g. a demo that adds
// gmail.com). Must be set before src/env.ts is first imported.
process.env.ALLOWED_EMAIL_DOMAINS = "vago-solutions.ai";
