# Reelnote

A mobile-first review-card website. It lets someone choose from their recent **public Letterboxd written reviews**, then opens the card maker with that review URL ready to use.

## Publish it from GitHub

1. Create a new GitHub repository and upload this `review-studio` folder.
2. Import that repository into **Vercel**. The included `api/reviews.js` route is needed because browsers cannot reliably fetch Letterboxd RSS due to CORS.
3. Use the Vercel URL as the link you send to friends. GitHub Pages alone can host the design, but it cannot run the review API or securely complete OAuth.

## Turn on email sign-in

Create a Supabase project, enable Email/OTP sign-in, and add your deployed website URL to its redirect allow-list. Then place the project URL and publishable (anon) key in the `AUTH` object at the top of `app.js`.

No email addresses, passwords, OAuth client secrets, or refresh tokens belong in the repository. Put server-only credentials in Vercel environment variables.

## Account connections

- **Letterboxd:** The website currently accepts a public username and reads the latest written reviews from the public RSS feed. For a true "Connect Letterboxd" authorization screen, register an OAuth application with Letterboxd and implement the callback/token exchange in serverless functions. Their OAuth authorization-code flow must not expose a client secret in browser code.
- **Serializd:** The site saves a public profile reference only. Serializd does not provide a documented public OAuth connection comparable to Letterboxd's, so private-account linking is intentionally not claimed or implemented.

## Limits

Letterboxd RSS is a recent-activity feed, so older reviews may not appear. The card maker also uses public proxies for direct review-page fallback; a private proxy can be configured when a network blocks those proxies.
