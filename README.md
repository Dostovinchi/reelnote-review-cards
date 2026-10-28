# Framix — cinematic review card studio

Framix is a static film and TV review-card creator. It includes a live poster/card preview, local PNG export, an optional public Letterboxd RSS importer, and a Supabase email/password sign-in interface.

## What costs $0

- **Hosting:** GitHub Pages on this public repository, with the included GitHub Actions workflow.
- **Review import:** Letterboxd's public films grid and RSS feed through a relay, because Letterboxd sends no CORS headers. By default the browser tries free public relays, which are shared, rate-limited by IP, and often unavailable — that is why imports succeed for some visitors and fail for others. Set `proxyBase` in `config.js` to your own free Cloudflare Worker (see [`worker/`](worker/)) for reliable imports. No Letterboxd password or OAuth token is used. The card editor and PNG export always work, even if the relay is down.
- **Card creation:** Canvas rendering and PNG download run locally in the browser. No images, notes, or card data are uploaded by the editor.
- **Authentication:** Supabase Free is enough for a small personal project. It currently includes 50,000 monthly active users and 500 MB database per project. Free projects may be paused after a week of low activity, so it is not a guaranteed always-on production service. See [Supabase pricing](https://supabase.com/pricing) and [free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

No paid API or service is required by the code. Stay on free plans and do not enable paid add-ons or overage billing. The free public relays, the optional Worker, and Supabase quotas/availability are not guaranteed.

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

## Letterboxd imports

1. Enter a public Letterboxd username or profile URL.
2. Framix reads the user's public `/films/by/rated-date/` view (newest rated first), extracts the member's rating from each poster's `rated-*` class, and continues through every page. Letterboxd requires browser-like `Accept-Language` headers for that sorted view, so it works through the Worker or another relay that forwards them; otherwise Framix falls back to the default `/films/` grid and lists recent RSS-dated ratings first. The parser targets Letterboxd's current markup (`li.griditem`, `data-item-slug`, `.poster-viewingdata .rating`).
3. Framix optionally matches entries from the public RSS feed to add review text and dates.
4. Choose **Use review** to move a film's title, rating, year and available review text into the poster editor.

Search the loaded ratings by film name and move between pages with the arrows (24 films per page).

The paginated catalogue is an unofficial public service and may be rate-limited, bot-protected, or unavailable. Framix tries a configured proxy first, then public relays, retries a failed page once, and keeps the pages it did get instead of discarding the whole shelf. If every page fails it may show only the smaller recent RSS results.

### Reliable imports (free Worker)

Free public relays rate-limit by IP and change availability constantly, so imports worked for some visitors and failed for others. [`worker/`](worker/) contains a small Cloudflare Worker that relays only the allowlisted public hosts and adds CORS.

```sh
cd worker
npx wrangler login
npx wrangler deploy
```

Then set the deployed URL in `config.js`:

```js
window.FRAMIX_CONFIG = { ..., proxyBase: "https://framix-proxy.your-name.workers.dev" };
```

The proxy base is configured in `config.js` only; the site has no in-page proxy field.

## Deploy

The `.github/workflows/deploy-pages.yml` workflow deploys the repository root to GitHub Pages on pushes to `main`. Keep `index.html`, `styles.css`, `app.js`, and `config.js` together in the root. `api/reviews.js` is retained for optional Vercel hosting (it now sends CORS headers). The Worker in `worker/` is deployed separately with Wrangler and is not part of the Pages build.

## Security

- Never commit a Supabase `service_role` key, SMTP password, or other server secret.
- Do not type a Letterboxd password into Framix.
- Keep the repository public for free GitHub Pages hosting; GitHub Pages has usage/acceptable-use limits and is intended for static sites, not for sensitive transactions or as a free commercial SaaS host. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).


## TMDB poster search and theme collections

The poster editor includes a TMDB title search for movies and TV series. Get your own API key in [TMDB account API settings](https://www.themoviedb.org/settings/api), paste the v3 API key into the editor, and choose **Save locally**. The key is stored in that browser's local storage; it is not committed to this repository or sent to a Framix backend. Do not paste a private key into public issues or commit it to GitHub. TMDB access is subject to its current terms and attribution requirements. Framix displays the required statement: “This product uses the TMDB API but is not endorsed or certified by TMDB.”

Theme collections:
- **Framix · General** — Noir, Midnight, Ember, Archive.
- **Letterboxd** — Green, Red, Blue, Gold inspired card palettes.

TMDB search needs your own API key; manual uploads and poster export remain available without it. Check TMDB's current API terms for eligibility and use restrictions.


## Automatic poster selection and Instagram Story export

When a rated film is selected, Framix automatically searches TMDB using the title and release year. The closest matching result is selected automatically only when the title looks like a reasonable match. The selected title's TMDB Images endpoint is then used to show its available poster-variant list; choose any thumbnail to replace the poster. Background artwork is chosen independently below it, and drives full-bleed layouts such as Blurred backdrop, Top banner and Cinema strip. If the key is saved after selecting a review, Framix re-runs the lookup for the current title.

TMDB documents the per-title poster/image endpoint for movies and TV, and image.tmdb.org URLs are built from the returned file paths. See the [TMDB movie images API](https://developer.themoviedb.org/reference/movie-images), [image URL basics](https://developer.themoviedb.org/docs/image-basics), and [application authentication](https://developer.themoviedb.org/docs/authentication-application).

The exported canvas is **1080 × 1920 px (9:16)**, matching Instagram Story dimensions. The download filename starts with framix-story-. The story layout uses adjusted top/bottom safe margins; review content may still need trimming if a particularly long note is used.

The API key is kept in this browser's local storage. Treat it like a personal credential and avoid sharing it in screenshots or public issue reports. Automatic selection depends on network access and TMDB's match quality. If TMDB has no poster for a title or its API is unavailable, the editor remains usable with your own upload.
