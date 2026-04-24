# Urlaubsverwaltung

A simple **personal** vacation tracker for employees in Germany — for keeping your own records, **not** an HR or company management tool.

> 🔗 **Live app**: <https://chenyue-vago.github.io/Urlaub/>

It calculates your German statutory + contractual vacation entitlement, knows the public holidays of your federal state, handles carry-over and cross-year vacations, and stores everything privately in your own browser — no account, no server, no shared data, no manager view.

## Getting started

Open the link above. On first visit you'll be asked for your **employment start date** — used to pro-rate your entitlement for the year you joined (later years always use the full 28 days).

Then in the top-right header you can:

- 🌐 Switch **language** between English and 中文.
- 📍 Pick your **region** (German federal state, `Bundesland`) so public holidays match.
- ⚙️ Open **Settings** to change the start date later, or back up / restore your data.

## Recording a vacation

Click **Record Vacation**, pick a date range, and optionally add a note. The app:

- Skips weekends and the public holidays of your selected region.
- Splits the days across carry-over → contractual → statutory automatically.
- Splits cross-year vacations per year so each year's quota is updated correctly.

Each record card lists the exact days it consumed (`DD.MM.`). If a vacation gets split across multiple buckets, each split shows only the days assigned to it.

## ⚠️ Don't lose your data

All data lives only in **your own browser** (`localStorage`). It is **not** synced anywhere. That means:

- A different browser, profile, machine, or an incognito window = different data.
- Clearing your browsing data for this site wipes everything.

To stay safe, use **⚙️ Settings → 💾 Backup & restore** regularly:

- 📤 **Export backup** — downloads a `urlaub-backup-YYYY-MM-DD.json` file. Save it somewhere safe (cloud drive, email to yourself, USB…).
- 📥 **Import backup** — pick a previously-exported file. **Overwrites** all current data, then reloads.

Tip: export once after adding several records, and again every few months as a manual snapshot. Always export before clearing browser data, switching machines, or using a different browser.

---

## Run or fork locally (optional)

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal. The GitHub Pages auto-deploy is configured in `.github/workflows/deploy.yml` and triggers on every push to `main`.
