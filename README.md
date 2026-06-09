# Urlaubsverwaltung

A simple **personal** vacation tracker for VAGO employees — for keeping your own records, **not** an HR or company management tool.

> 🔗 **Live app**: <https://chenyue-vago.github.io/Urlaub/>

It calculates your German statutory + contractual vacation entitlement, knows the public holidays of your federal state, handles carry-over and cross-year vacations, and stores everything in Supabase.

## Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### Database setup
1. In Supabase Dashboard → SQL Editor, run the contents of `supabase/migrations/001_initial_schema.sql`
2. In Authentication → Sign In / Up → Email, disable "Confirm email" (recommended for a personal tool)

### Local development
1. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key (from Dashboard → Settings → API)
2. `npm install`
3. `npm run dev`

### Deploy to GitHub Pages
Add two repository secrets (Settings → Secrets and variables → Actions):
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

### Auth model
- Open signup — anyone with the URL can register
- First registered user automatically becomes admin
- Admins can promote/demote users, activate/deactivate accounts, and edit global vacation entitlement settings

## Recording a vacation

Click **Record Vacation**, pick a date range, and optionally add a note. The app:

- Skips weekends and the public holidays of your selected region.
- Splits the days across carry-over → contractual → statutory automatically.
- Splits cross-year vacations per year so each year's quota is updated correctly.

Each record card lists the exact days it consumed (`DD.MM.`). If a vacation gets split across multiple buckets, each split shows only the days assigned to it.
