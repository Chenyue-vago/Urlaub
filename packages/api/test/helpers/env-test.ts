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
