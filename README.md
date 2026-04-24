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

### To keep your records, always open the app from the same place

`localStorage` is scoped per **browser** *and* per **origin** (`scheme://host:port`). To make sure your vacation entries are still there next time you open the app:

- **Same machine, same browser, same profile** Records you added in Chrome won't show up in Firefox, in another Chrome user profile, or in an incognito/private window — each has its own isolated `localStorage`.
- **Avoid "Clear site data" / "Clear browsing data → Cookies and site data"** for this site, otherwise everything is gone.

If you need to switch browsers, machines, ports, or want a safety net before clearing site data, use the built-in **Backup & restore** below.

### Backup & restore

Open the **gear icon** at the top right and use the **💾 Backup & restore** section:

- **📤 Export backup** — downloads a `urlaub-backup-YYYY-MM-DD.json` file containing all your data (records, employment start date, language, region, last viewed year). Save this somewhere safe (cloud drive, email to yourself, USB, …).
- **📥 Import backup** — pick a previously-exported JSON file. After confirming, the file's contents **overwrite** everything currently in `localStorage` and the page reloads.

## Deploy to GitHub Pages

This repo ships a workflow at `.github/workflows/deploy.yml` that builds the app and deploys it to GitHub Pages on every push to `main`.

**One-time setup** (only the repo owner does this, once):

1. Push the workflow to `main`.
2. On GitHub, open the repo → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions** (not "Deploy from a branch").
4. Push anything to `main` (or open the **Actions** tab and re-run the latest "Deploy to GitHub Pages" workflow). When it goes green, the site is live at:

   ```
   https://<github-user>.github.io/<repo-name>/
   ```

   For this repo: <https://chenyue-vago.github.io/Urlaub/>.

**Notes**:

- `vite.config.ts` sets `base: '/Urlaub/'` only at build time so all asset URLs resolve under the repo subpath. If you fork to a repo with a different name, change this string.
- `public/robots.txt` (`Disallow: /`) and a `<meta name="robots" content="noindex, nofollow" />` in `index.html` ask search engines not to index the site, since this is a personal tracker, not a public service. The URL is still publicly reachable to anyone you share it with — there is no login.
- All data still lives in each user's own browser `localStorage`. Deploying does not create any shared backend.