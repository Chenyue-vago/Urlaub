# CLAUDE.md

Project guidance for Claude Code working in this repo.

## TODO

- [ ] Add a PR-triggered CI workflow: run `npm test` + `npm run build` on
      `pull_request` events (currently CI only runs on push to `main`). This is
      required so the `main` branch-protection ruleset can gate merges on
      "CI must pass".
- [ ] M6/M7: migrate `packages/web` off its local `src/utils.ts` entitlement
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
