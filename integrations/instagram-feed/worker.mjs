// Deploy independently of the Shopify theme. No Shopify app is required.
const DAY = 86400000;

async function graph(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Instagram request failed; check connection and permissions');
  return body;
}

export async function syncFeed(env) {
  let auth = await env.INSTAGRAM_STATE.get('auth', 'json');
  if (!auth || auth.seed !== env.INSTAGRAM_TOKEN_ISSUED_AT) {
    const issued = Date.parse(env.INSTAGRAM_TOKEN_ISSUED_AT);
    if (!env.INSTAGRAM_ACCESS_TOKEN || !Number.isFinite(issued)) throw new Error('Configure a long-lived token and its issue timestamp');
    auth = { token: env.INSTAGRAM_ACCESS_TOKEN, refreshed: issued, seed: env.INSTAGRAM_TOKEN_ISSUED_AT };
  }
  if (Date.now() - auth.refreshed >= 30 * DAY) {
    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    // Meta requires the token parameter on this endpoint. Never log this URL.
    url.searchParams.set('access_token', auth.token);
    const result = await graph(url, auth.token);
    if (!result.access_token || !result.expires_in) throw new Error('Invalid token refresh response');
    auth = { ...auth, token: result.access_token, refreshed: Date.now(), expires: Date.now() + result.expires_in * 1000 };
  }
  await env.INSTAGRAM_STATE.put('auth', JSON.stringify(auth));
  if (!/^v\d+\.\d+$/.test(env.INSTAGRAM_API_VERSION) || !/^\d+$/.test(env.INSTAGRAM_USER_ID)) throw new Error('Configure API version and Instagram user ID');
  const url = new URL(`https://graph.instagram.com/${env.INSTAGRAM_API_VERSION}/${env.INSTAGRAM_USER_ID}/media`);
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}');
  url.searchParams.set('limit', '24');
  const result = await graph(url, auth.token);
  if (!Array.isArray(result.data)) throw new Error('Invalid media response');
  // Explicit allowlist: never publish tokens, account credentials or paging URLs.
  const cleanMedia = (post) => Object.fromEntries(['id', 'caption', 'media_type', 'media_url', 'thumbnail_url', 'permalink', 'timestamp'].filter((key) => typeof post[key] === 'string').map((key) => [key, post[key]]));
  const data = result.data.map((post) => ({ ...cleanMedia(post), ...(post.children?.data ? { children: { data: post.children.data.map(cleanMedia) } } : {}) }));
  await env.INSTAGRAM_STATE.put('feed', JSON.stringify({ data, updated_at: new Date().toISOString() }), { expirationTtl: 7200 });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/feed') return new Response('Not found', { status: 404 });
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim());
    const headers = { 'Content-Type': 'application/json', Vary: 'Origin', 'Cache-Control': 'no-store' };
    if (origin && !allowed.includes(origin)) return new Response('{"error":"Origin not allowed"}', { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
    if (request.method !== 'GET') return new Response('{"error":"Method not allowed"}', { status: 405, headers });
    const feed = await env.INSTAGRAM_STATE.get('feed');
    if (!feed) return new Response('{"data":[]}', { status: 503, headers });
    return new Response(feed, { headers: { ...headers, 'Cache-Control': 'public, max-age=300' } });
  },
  async scheduled(event, env, ctx) {
    // Throw failures for Workers monitoring; never log tokens or full API responses.
    ctx.waitUntil(syncFeed(env));
  }
};
