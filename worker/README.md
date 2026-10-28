# Framix relay (Cloudflare Worker, free tier)

Letterboxd does not send CORS headers, so a browser page cannot read
`letterboxd.com/<user>/films/`. The public free relays the site used to fall back
on are unreliable and rate-limit by IP, which is why imports worked for some
visitors and failed for others.

This Worker is a small, free, allowlisted relay for:

- `letterboxd.com` (RSS + public film pages)
- `api.themoviedb.org` (optional, if `TMDB_KEY` is set)
- `image.tmdb.org` (poster images, useful where TMDB is blocked)

## Deploy

```sh
cd worker
npx wrangler login          # once per machine
npx wrangler deploy
```

Copy the printed URL (for example `https://framix-proxy.your-name.workers.dev`)
into `proxyBase` in the root `config.js`, then commit and push so GitHub Pages
redeploys.

Optional, so visitors do not need their own TMDB key:

```sh
npx wrangler secret put TMDB_KEY
```

## Notes

- Free plan: 100,000 requests/day. Letterboxd and image responses are cached for
  5 minutes per Cloudflare edge location.
- Only the allowlisted hosts are proxied; everything else returns 403.
- The relay serves public data only. No cookies or credentials are forwarded.
- Visitors can also paste their own relay URL in the site under
  "Ratings not loading?", which is stored in their browser only.
