import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { syncFeed } from './worker.mjs';

function environment(age = 1) {
  const values = new Map();
  return {
    values,
    INSTAGRAM_STATE: {
      async get(key, type) { const value = values.get(key); return value && type === 'json' ? JSON.parse(value) : value || null; },
      async put(key, value, options) { values.set(key, value); if (options) values.set(`${key}:ttl`, options.expirationTtl); }
    },
    INSTAGRAM_ACCESS_TOKEN: 'private-seed-token',
    INSTAGRAM_TOKEN_ISSUED_AT: new Date(Date.now() - age * 86400000).toISOString(),
    INSTAGRAM_USER_ID: '1234', INSTAGRAM_API_VERSION: 'v99.0',
    ALLOWED_ORIGINS: 'https://flowers.example'
  };
}

test('feed is cached, credentials and paging URLs are excluded, CORS is restricted', async (t) => {
  const env = environment();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, 'Bearer private-seed-token');
    assert.equal(url.searchParams.has('access_token'), false);
    return Response.json({ data: [{ id: '1', media_type: 'IMAGE', media_url: 'https://cdn.example/image.jpg', access_token: 'leak', children: { data: [{ media_type: 'IMAGE', media_url: 'https://cdn.example/child.jpg', secret: 'leak' }] } }], paging: { next: 'https://example.com/?access_token=leak' } });
  });
  await syncFeed(env);
  const response = await worker.fetch(new Request('https://feed.example/feed', { headers: { Origin: 'https://flowers.example' } }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://flowers.example');
  const body = await response.text();
  assert.doesNotMatch(body, /private-seed-token|leak|paging/);
  assert.equal(JSON.parse(body).data[0].children.data[0].media_type, 'IMAGE');
  assert.equal(env.values.get('feed:ttl'), 7200);
  assert.equal(calls, 1);
  assert.equal((await worker.fetch(new Request('https://feed.example/feed', { headers: { Origin: 'https://other.example' } }), env)).status, 403);
});

test('missing feed returns failure for theme fallback and requests never call Meta', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not call Meta'); });
  const response = await worker.fetch(new Request('https://feed.example/feed'), environment());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { data: [] });
});

test('refreshes older token, persists replacement and uses it for media', async (t) => {
  const env = environment(31);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.pathname === '/refresh_access_token') return Response.json({ access_token: 'private-refreshed-token', expires_in: 5184000 });
    assert.equal(options.headers.Authorization, 'Bearer private-refreshed-token');
    return Response.json({ data: [] });
  });
  await syncFeed(env);
  const auth = JSON.parse(env.values.get('auth'));
  assert.equal(auth.token, 'private-refreshed-token');
  assert.ok(auth.expires > Date.now());
  assert.doesNotMatch(env.values.get('feed'), /private/);
});

test('upstream failure does not overwrite last successful cached feed', async (t) => {
  const env = environment();
  env.values.set('feed', '{"data":[{"id":"existing"}]}');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Sensitive upstream detail' } }, { status: 401 }));
  await assert.rejects(syncFeed(env), /check connection and permissions/);
  assert.equal(env.values.get('feed'), '{"data":[{"id":"existing"}]}');
});
