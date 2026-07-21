# CLAUDE.md

Project guidance for Claude Code working in this repo.

## TODO

- [ ] Add a PR-triggered CI workflow: run `npm test` + `npm run build` on
      `pull_request` events (currently CI only runs on push to `main`). This is
      required so the `main` branch-protection ruleset can gate merges on
      "CI must pass".
