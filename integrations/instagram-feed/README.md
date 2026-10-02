# Instagram feed for Social gallery

The theme displays API posts using the existing gallery and modal. Manual blocks remain the fallback on failed, empty or invalid feeds. The theme editor always displays manual blocks so they remain editable. Carousel albums display their first item, with a link to the complete Instagram post.

This service runs separately on Cloudflare Workers; it is not a Shopify app. The theme receives public media only. Do not put Instagram access tokens in theme settings or feed URLs.

## Connect the account

1. Use a Meta developer app with **Instagram API with Instagram Login**, a Business or Creator account, and `instagram_business_basic`. Authorize the account and obtain a **long-lived** token server-side using Meta's setup flow. Confirm the required access level for your account in the Meta dashboard. A Meta app is still required, even though no Shopify app is installed.
2. In Cloudflare, create a Worker and a private KV namespace bound as `INSTAGRAM_STATE`. Use `worker.mjs` and the settings in `wrangler.toml.example` (copy to `wrangler.toml` if deploying with Wrangler). Set the Instagram user ID, a currently supported API version, the actual long-lived token issue timestamp, and exact storefront origins. Exclude trailing slashes from origins.
3. Add `INSTAGRAM_ACCESS_TOKEN` as a **Worker secret**, not a public variable or committed file. Keep the KV namespace private: its `auth` record contains the refreshed token. Restrict Cloudflare account access accordingly.
4. Configure the hourly cron trigger. The first successful scheduled run populates `/feed`. Visitors never trigger an Instagram API call. Enable Workers failure monitoring; a missed refresh or revoked authorization requires attention.
5. In Shopify's theme editor, open **Social gallery**, select **Instagram API with manual fallback**, enter `https://YOUR-WORKER.workers.dev/feed`, set account name and post count, and save. Populate the manual blocks with suitable backup images/videos.

## Refresh and fallback

Scheduled runs refresh a token once it is 30 days old and persist the returned token. Meta's expected long-lived lifetime is 60 days; refresh must occur before expiry. Check current token rules during account setup and validate the live `expires_in` response. When reconnecting, replace the secret and update the issue timestamp together so the stored token is reset.

The feed cache expires after two hours without a successful sync. At that point the service returns 503 and visitors retain manual posts instead of indefinitely displaying stale Instagram media. Each browser request has an eight-second timeout. Invalid/broken thumbnails are skipped; if none load, manual posts stay visible. Video playback errors restore manual posts. Videos download only when opened.

No account credentials are included in the public response. CORS restricts browser access to the configured storefronts; it does not make publicly displayed posts private.

## Verification and limits

Run `node --test integrations/instagram-feed/worker.test.mjs integrations/instagram-feed/gallery.test.mjs` from the theme root. Live account verification requires the deployed service and authorized Instagram account. No deployment or token connection is performed by adding these files. The service does not implement a multi-account OAuth/admin interface. Use Meta's account setup flow for this single account.

Official documentation:
- https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
- https://developers.facebook.com/docs/instagram-platform/reference/access_token/
- https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
