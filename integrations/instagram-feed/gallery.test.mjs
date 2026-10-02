import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/theme.js', import.meta.url), 'utf8');
const gallerySource = source.slice(source.indexOf('class OsSocialGallery'), source.indexOf("if (!customElements.get('os-social-gallery'))"));

function gallery(fetchResponse) {
  const context = { HTMLElement: class {}, AbortController, URL, setTimeout, clearTimeout, location: { origin: 'https://shop.example' }, fetch: async () => fetchResponse };
  vm.createContext(context);
  vm.runInContext(`${gallerySource}; this.Gallery = OsSocialGallery;`, context);
  const instance = new context.Gallery();
  instance.galleryAbort = new AbortController();
  instance.dataset = { feedUrl: 'https://feed.example/feed', feedLimit: '2' };
  instance.isConnected = true;
  instance.buildInstagramPost = async (post) => post.broken ? null : { card: { dataset: {} }, slide: { id: post.id } };
  instance.replacePosts = (cards, slides) => { instance.replacement = { cards, slides }; };
  return { instance, context };
}

test('API posts replace fallback only after successful thumbnail validation', async () => {
  const { instance } = gallery(Response.json({ data: [{ id: 'bad', media_type: 'IMAGE', broken: true }, { id: 'valid', media_type: 'VIDEO' }, { id: 'over-limit', media_type: 'IMAGE' }] }));
  await instance.loadInstagram();
  assert.equal(instance.dataset.feedState, 'instagram');
  assert.equal(instance.replacement.cards.length, 1);
  assert.equal(instance.replacement.cards[0].dataset.socialIndex, 0);
  assert.equal(instance.replacement.slides[0].id, 'valid');
});

test('HTTP errors, invalid data, empty feeds and broken thumbnails preserve fallback', async () => {
  for (const response of [new Response('', { status: 503 }), Response.json({}), Response.json({ data: [] }), Response.json({ data: [{ media_type: 'IMAGE', broken: true }] }), new Response('not json')]) {
    const { instance } = gallery(response);
    await instance.loadInstagram();
    assert.equal(instance.replacement, undefined);
  }
});

test('disconnect prevents late responses from replacing the section', async () => {
  const { instance } = gallery(Response.json({ data: [{ media_type: 'IMAGE' }] }));
  instance.galleryAbort.abort();
  await instance.loadInstagram();
  assert.equal(instance.replacement, undefined);
});

test('token-bearing URLs and insecure endpoints are never requested', async () => {
  for (const url of ['http://feed.example/feed', 'https://feed.example/feed?access_token=private', 'https://user:password@feed.example/feed']) {
    const { instance, context } = gallery(null);
    instance.dataset.feedUrl = url;
    context.fetch = async () => assert.fail('Unsafe endpoint was fetched');
    await instance.loadInstagram();
    assert.equal(instance.replacement, undefined);
  }
});
