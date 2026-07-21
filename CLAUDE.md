# CLAUDE.md

Project guidance for Claude Code working in this repo.

## TODO

- [ ] Add a PR-triggered CI workflow: run `npm test` + `npm run build` on
      `pull_request` events (currently CI only runs on push to `main`). This is
      required so the `main` branch-protection ruleset can gate merges on
      "CI must pass".
- [x] M6/M7: migrate `packages/web` off its local `src/utils.ts` entitlement
      math — make it use `@urlaub/shared` (App.tsx currently still imports the
      old hardcoded copy; remove it when App.tsx becomes the thin router
      shell).
- [ ] Add runtime format validation for `EntitlementConfig.carryOverDeadline`
      ("MM-DD") once it becomes API-configurable (currently only
      default/test configs are used).
- [ ] Remove or relocate `packages/web/scripts/extract-de-holidays.mjs`
      prebuild step — it regenerates an unused
      `packages/web/src/data/de-holidays.json`; the committed copy in
      `packages/shared/src/data/` is the source of truth now.
- [ ] Expose half-day vacation on the createLeave path (schema + getBalance
      already support Decimal 0.5; `CreateLeaveInput`/`countWorkDaysByYear`
      currently only produce whole days — needs input + UI design in a later
      milestone).
- [ ] Enforce a required `decision_note` on reject at the M5 route layer
      (spec §7); the service currently accepts an optional note.
- [ ] Auth hardening (M3 review, non-blocking): require `CLERK_SECRET_KEY` at
      `buildServer()` time for the real `ClerkAuthenticator` path so a missing
      key fails loudly at startup instead of 401-ing every request in prod.
- [ ] Auth hardening: pass `authorizedParties` to Clerk `verifyToken` for
      audience pinning (defense-in-depth if the secret is shared across envs).
- [ ] Make `resolveUser` upsert race-safe: catch Prisma P2002 on the create
      branch (concurrent first-time login of the same clerkId) and re-fetch,
      instead of surfacing a 500.
