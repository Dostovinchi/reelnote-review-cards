// Free Cloudflare Worker relay for Framix.
// Letterboxd sends no CORS headers, so the browser cannot call it directly.
// This worker fetches only allowlisted public hosts and adds CORS.
//
// Deploy:
//   cd worker && npx wrangler deploy
//   npx wrangler secret put TMDB_KEY   (optional: lets visitors skip pasting a key)
// Then set proxyBase in config.js to the deployed worker URL.

const ALLOWED_HOSTS = new Set([
  "letterboxd.com",
  "www.letterboxd.com",
  "api.themoviedb.org",
  "image.tmdb.org"
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400"
};

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" }
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET") return json({ error: "GET only" }, 405);

    const raw = url.searchParams.get("url");
    if (!raw) return json({ error: "Missing ?url= parameter" }, 400);

    let target;
    try {
      target = new URL(raw);
    } catch {
      return json({ error: "Invalid URL" }, 400);
    }
    if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
      return json({ error: "Host not allowed" }, 403);
    }

    const isTMDB = target.hostname === "api.themoviedb.org";
    if (isTMDB && !target.searchParams.has("api_key")) {
      const key = url.searchParams.get("key") || env.TMDB_KEY;
      if (key) target.searchParams.set("api_key", key);
    }

    const isLetterboxd = target.hostname.endsWith("letterboxd.com");
    const isImage = target.hostname === "image.tmdb.org";
    const useCache = !isTMDB;
    const cache = caches.default;
    const cacheKey = new Request(target.origin + target.pathname + (isImage || isLetterboxd ? "" : target.search));

    if (useCache) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    const accept = isImage
      ? "image/*"
      : isLetterboxd && target.pathname.endsWith("/rss/")
        ? "application/rss+xml, application/xml, text/xml, */*"
        : "text/html,application/json,*/*";

    let upstream;
    try {
      upstream = await fetch(target.href, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FramixRelay/1.0; +https://github.com/Dostovinchi/reelnote-review-cards)",
          "Accept": accept,
          "Accept-Language": "en"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });
      if ([403, 429, 503].includes(upstream.status)) {
        await new Promise(resolve => setTimeout(resolve, 600));
        upstream = await fetch(target.href, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FramixRelay/1.0; +https://github.com/Dostovinchi/reelnote-review-cards)",
            "Accept": accept,
            "Accept-Language": "en"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(20000)
        });
      }
    } catch (error) {
      return json({ error: "Upstream unreachable", detail: String(error?.message || error) }, 502);
    }

    const headers = new Headers(CORS);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || (isImage ? "image/jpeg" : "text/plain; charset=utf-8"));
    headers.set("X-Relay-Status", String(upstream.status));
    headers.set("Cache-Control", upstream.ok ? "public, max-age=300" : "no-store");

    const response = new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
    if (useCache && upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};
