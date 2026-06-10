import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // index.css is imported after this module's load chain, so style inline and
  // paint a friendly screen directly into #root before halting. Without this
  // the uncaught error just leaves a blank page.
  renderConfigError();
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

function renderConfigError(): void {
  if (typeof document === 'undefined') return;
  const mount = document.getElementById('root') ?? document.body;
  if (!mount) return;

  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !anonKey && 'VITE_SUPABASE_ANON_KEY',
  ]
    .filter(Boolean)
    .join(', ');

  mount.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
                font-family:'DM Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
                background:#f0faf0;color:#1b3a2b;box-sizing:border-box;">
      <div style="max-width:520px;width:100%;background:#fff;border:1px solid #cdeccd;border-radius:16px;
                  padding:32px;box-shadow:0 10px 40px rgba(0,0,0,0.06);">
        <div style="font-size:40px;line-height:1;margin-bottom:16px;">🌿</div>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Configuration needed</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a5a47;">
          This app can't start because its database connection isn't configured yet.
        </p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#3a5a47;">Missing:</p>
        <pre style="margin:0 0 16px;padding:12px 14px;background:#f3f8f3;border-radius:10px;
                    font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
                    font-size:13px;color:#b3261e;white-space:pre-wrap;word-break:break-word;">${missing}</pre>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7d72;">
          If you're deploying this app, set these as repository secrets (CI) or in a
          local <code style="background:#f3f8f3;padding:1px 5px;border-radius:5px;">.env</code> file.
          See <code style="background:#f3f8f3;padding:1px 5px;border-radius:5px;">.env.example</code>.
        </p>
      </div>
    </div>
  `;
}
