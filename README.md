# Framix — cinematic review card studio

Framix is a static film and TV review-card creator. It includes a live poster/card preview, local PNG export, an optional public Letterboxd RSS importer, and a Supabase email/password sign-in interface.

## What costs $0

- **Hosting:** GitHub Pages on this public repository, with the included GitHub Actions workflow.
- **Review import:** Letterboxd's public RSS feed via a free public GET relay. No Letterboxd password, OAuth token, paid proxy key, or backend subscription is used. The relay is a shared third-party service with fair-use limits and may occasionally be unavailable; the card editor and PNG export continue to work if it is.
- **Card creation:** Canvas rendering and PNG download run locally in the browser. No images, notes, or card data are uploaded by the editor.
- **Authentication:** Supabase Free is enough for a small personal project. It currently includes 50,000 monthly active users and 500 MB database per project. Free projects may be paused after a week of low activity, so it is not a guaranteed always-on production service. See [Supabase pricing](https://supabase.com/pricing) and [free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

No paid API or service is required by the code. Stay on free plans and do not enable paid add-ons or overage billing. The free third-party RSS relay and Supabase quotas/availability are not guaranteed.

## Turn on secure sign-in (free-tier setup)

A real auth project has to be created in your own Supabase account; its project URL and public browser key are unique to your project, so they cannot be safely guessed or filled in by this repository.

1. Create a project on the [Supabase Free plan](https://supabase.com/dashboard). Do not select a paid plan or add paid compute.
2. In Project Settings → API Keys, copy the **Project URL** and the **publishable key** (or legacy anon key). The publishable/anon key is intended for browser use; never use a `service_role` key in this site.
3. Put the URL and key in `config.js`:
   ```js
   window.FRAMIX_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-PUBLISHABLE-KEY"
   };
   ```
4. In Authentication → Providers, enable Email. In Authentication → URL Configuration, set the Site URL and allowed redirect URL to:
   `https://dostovinchi.github.io/reelnote-review-cards/`
5. For **real public sign-ups with email verification and password recovery**, configure SMTP with a provider that has a free tier and verify a sender address. Supabase's built-in mailer is only for testing: at present it only delivers to project-team addresses and is limited to 2 messages/hour. See [Supabase email rate limits](https://supabase.com/docs/guides/auth/rate-limits). Do not disable email confirmation just to bypass those restrictions if you need verified, recoverable accounts.

Until those project-specific steps are done, the sign-in dialog intentionally explains that authentication is not configured. Card creation does not require an account.

## Letterboxd feed behavior

1. Use your public Letterboxd username or profile URL.
2. Framix reads the public RSS feed and filters for written reviews, then displays up to 12 recent entries.
3. Select **Use this review** to populate the editor's title, year, date, rating, and review text. Upload poster artwork separately if you want it in the exported image; this avoids relying on cross-origin poster downloads.
4. A free CORS relay is used because GitHub Pages is a static host and browser requests to Letterboxd may be blocked by CORS. This is for public GET data only. No Letterboxd password or private account data is requested.

The automatic feed is based on Letterboxd's public RSS contents, so it can only show entries present in the feed and accessible through the public relay.

## Deploy

The `.github/workflows/deploy-pages.yml` workflow deploys the repository root to GitHub Pages on pushes to `main`. Keep `index.html`, `styles.css`, `app.js`, and `config.js` together in the root.

The `api/reviews.js` and `vercel.json` files are retained for optional Vercel hosting, but the new importer does **not** depend on Vercel.

## Security

- Never commit a Supabase `service_role` key, SMTP password, or other server secret.
- Do not type a Letterboxd password into Framix.
- Keep the repository public for free GitHub Pages hosting; GitHub Pages has usage/acceptable-use limits and is intended for static sites, not for sensitive transactions or as a free commercial SaaS host. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).


## TMDB poster search and theme collections

The poster editor includes a TMDB title search for movies and TV series. Get your own API key in [TMDB account API settings](https://www.themoviedb.org/settings/api), paste the v3 API key into the editor, and choose **Save locally**. The key is stored in that browser's local storage; it is not committed to this repository or sent to a Framix backend. Do not paste a private key into public issues or commit it to GitHub. TMDB access is subject to its current terms and attribution requirements. Framix displays the required statement: “This product uses the TMDB API but is not endorsed or certified by TMDB.”

Theme collections:
- **Framix · General** — Noir, Midnight, Ember, Archive.
- **Letterboxd** — Green, Red, Blue, Gold inspired card palettes.
- **Serializd** — Violet, Pink, Cyan, Lime TV-diary palettes.

TMDB search needs your own API key; manual uploads and poster export remain available without it. Check TMDB's current API terms for eligibility and use restrictions.
