# Framix — cinematic review card studio

A static, GitHub Pages-friendly rebrand of Reelnote. The poster/review card creator is integrated into the homepage, with live canvas preview and local PNG export.

## Included
- `index.html` — landing page, integrated editor, preview, authentication dialogs.
- `styles.css` — responsive visual system.
- `app.js` — local card rendering/export and Supabase email/password auth.
- `config.js` — public Supabase URL/key placeholders.
- `supabase/schema.sql` — optional starter profile table with row-level security.

## Enable real authentication
1. Create a project at https://supabase.com/.
2. In Project Settings → API, copy the project URL and publishable key (or legacy anon key).
3. Add them to `config.js` as `supabaseUrl` and `supabaseAnonKey`.
4. Enable Email under Authentication → Providers.
5. Set the production GitHub Pages URL under Authentication → URL Configuration, including allowed redirects.
6. Configure email verification, recovery templates, and preferably custom SMTP.
7. Deploy on HTTPS and test sign-up, verification, sign-in, sign-out, and password recovery.

The browser key is public. Never put a Supabase service_role key, database password, or other server secret in static frontend files. The card editor runs locally and does not save card content to a server.

## Deploy
Keep `index.html`, `styles.css`, `app.js`, and `config.js` together in the published root. Google Fonts and Supabase JS are loaded from CDNs, so internet access is required for those assets.
