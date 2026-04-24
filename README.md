# Urlaubsverwaltung

A simple personal vacation tracker for employees. Built with Vite + React + TypeScript. 

## Features

- **Yearly entitlement**: 20 statutory (`Gesetzlich`) + 8 contractual (`Vertraglich`) days, pro-rated for the year you joined.
- **Carry-over awareness**: unused statutory days carry into the next year and expire on March 31. The app prioritizes carry-over for vacations ending on or before that deadline.
- **Region-aware public holidays**: pick your German federal state (`Bundesland`) and the workday calculation automatically excludes the right public holidays.
- **Cross-year vacations**: a vacation that spans New Year is automatically split and counted against the right year's quota.
- **Per-record day list**: each record shows the exact `DD.MM.` workdays it consumed. When a single vacation is split across multiple buckets (carry-over → contractual → statutory, in that priority order), each split lists only the days assigned to it.
- **Backup & restore**: export your data to a JSON file and import it later — see [Backup & restore](#backup--restore) below.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (default: http://localhost:5173).

If port `5173` is already in use, Vite will automatically pick the next free port (5174, 5175, …) — just use whatever URL it prints. To pin a specific port instead, pass it on the command line:

```bash
npm run dev -- --port 3000        # use port 3000
npm run dev -- --port 3000 --host # also expose on your LAN
```

Or set it permanently in `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
})
```

## First-time use

On first open you'll be asked for your **employment start date**. This value is used to pro-rate your entitlement for the year you joined. Later years always use the full 28 days.

After that, optionally:

1. Top right: pick your **language**. Only English and Chinese (`中文`) are supported at the moment.
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

### To keep your records, always open the app from the same place

`localStorage` is scoped per **browser** *and* per **origin** (`scheme://host:port`). To make sure your vacation entries are still there next time you open the app:

- **Same browser, same profile.** Records you added in Chrome won't show up in Firefox, in another Chrome user profile, or in an incognito/private window — each has its own isolated `localStorage`.
- **Same machine.** Records on your laptop won't appear on your phone, your work desktop, or any colleague's machine.
- **Same URL — same host *and* port.** The URL `http://localhost:5173` is a different origin from `http://localhost:5174`, `http://127.0.0.1:5173`, or `http://192.168.178.33:5173`. Each origin has its own `localStorage`. So always start the dev server with the **same port** (`npm run dev -- --port 5173`) and always open it via the **same URL** you used last time.
- **Don't use incognito / private windows for real data.** Their `localStorage` is wiped the moment you close the last incognito window.
- **Avoid "Clear site data" / "Clear browsing data → Cookies and site data"** for this site, otherwise everything is gone.

If you need to switch browsers, machines, ports, or want a safety net before clearing site data, use the built-in **Backup & restore** below.

### Backup & restore

Open the **gear icon** at the top right and use the **💾 Backup & restore** section:

- **📤 Export backup** — downloads a `urlaub-backup-YYYY-MM-DD.json` file containing all your data (records, employment start date, language, region, last viewed year). Save this somewhere safe (cloud drive, email to yourself, USB, …).
- **📥 Import backup** — pick a previously-exported JSON file. After confirming, the file's contents **overwrite** everything currently in `localStorage` and the page reloads.

Practical tips:

- Export once after adding several records, and again every few months as a manual backup.
- When moving to a new browser / machine / port: export from the old one first, then import on the new one.
- The file is plain JSON — you can open it in any text editor to inspect or hand-edit before importing.
- Import is **destructive**: it replaces all current data with what's in the file. There is no merge across multiple devices, so don't edit the same data on two devices in parallel and expect both sets of edits to survive an import.

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
