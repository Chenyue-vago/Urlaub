# Urlaubsverwaltung

A simple personal vacation tracker for employees working in Germany. Built with Vite + React + TypeScript. All data stays in your browser via `localStorage` — no backend, no account, nothing leaves your machine.

## Features

- **Yearly entitlement**: 20 statutory (`Gesetzlich`) + 8 contractual (`Vertraglich`) days, pro-rated for the year you joined.
- **Carry-over awareness**: unused statutory days carry into the next year and expire on March 31. The app prioritizes carry-over for vacations ending on or before that deadline.
- **Region-aware public holidays**: pick your German federal state (`Bundesland`) and the workday calculation automatically excludes the right public holidays.
- **Cross-year vacations**: a vacation that spans New Year is automatically split and counted against the right year's quota.
- **Per-record day list**: each record shows the exact `DD.MM.` workdays it consumed. When a single vacation is split across multiple buckets (carry-over → contractual → statutory, in that priority order), each split lists only the days assigned to it instead of repeating the full range.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## First-time use

On first open you'll be asked for your **employment start date** (in English, regardless of language preference). This value is used to pro-rate your entitlement for the year you joined. Later years always use the full 28 days.

After that, optionally:

1. Top right: pick your **language** (`EN` / `中文`).
2. Top right: pick your **region** (e.g. `Baden-Württemberg`, `Bayern`, …) so public holidays match.
3. Click the **gear icon** any time to change your employment start date.

## Recording a vacation

Click **Record Vacation**, pick a date range, and (optionally) add a note. The app will:

- Skip weekends and the public holidays of your selected region.
- Show how many workdays you'd use, and split them by carry-over / contractual / statutory before you save.
- For ranges that cross a year boundary, split the entry per year so each year's quota is updated correctly.

## Where is my data?

In your browser only — under `localStorage` keys starting with `urlaub_`:

- `urlaub_manager_data` — your vacation records
- `urlaub_employment_start` — your start date
- `urlaub_language` — your preferred language
- `urlaub_region` — your selected `Bundesland`
- `urlaub_selected_year` — last viewed year

This means data is **not synced** between browsers, devices, or incognito windows. Clearing site data wipes everything.

## Build for production

```bash
npm run build       # type-check + bundle into dist/
npm run preview     # serve the bundled output locally
```

The bundled `dist/` folder is fully static and can be hosted on any static file host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, an Nginx server, …).

## Project layout

```
src/
  App.tsx          # main UI
  i18n.ts          # English / Chinese dictionaries + LanguageProvider
  regions.ts       # 16 German Bundesländer
  holidays.ts      # public-holiday lookup via date-holidays-parser
  utils.ts         # date math, allocation logic, localStorage helpers
  data/            # extracted Germany-only holiday data (auto-generated)
  types.ts         # shared TypeScript types
scripts/
  extract-de-holidays.mjs   # runs before dev/build to keep src/data/de-holidays.json minimal
```

## Tech notes

- Public holidays are computed offline using [`date-holidays-parser`](https://github.com/commenthol/date-holidays-parser) with a Germany-only data slice extracted at build time, keeping the bundle small while staying accurate.
- `npm run dev` and `npm run build` automatically run the extraction script via `predev` / `prebuild` hooks.
