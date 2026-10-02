import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/theme.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function createViewportAutoplay'), source.indexOf('function initializeEditorialCarousel'));
function setup() {
  const timers = new Map();
  let id = 0;
  class Target {
    listeners = new Map();
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type) { this.listeners.delete(type); }
    emit(type, event = {}) { this.listeners.get(type)?.(event); }
    contains(node) { return node === this; }
  }
  const element = new Target();
  element.isConnected = true;
  element.dataset = {};
  const document = new Target();
  document.hidden = false;
  const motion = new Target();
  motion.matches = false;
  let observer;
  const context = {
    document,
    window: { matchMedia: () => motion, setInterval: (fn) => { timers.set(++id, fn); return id; }, clearInterval: (id) => timers.delete(id) },
    IntersectionObserver: class {
      constructor(callback) { observer = this; this.callback = callback; }
      observe() {}
      disconnect() { this.disconnected = true; }
      show(ratio) { this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
    }
  };
  vm.createContext(context);
  vm.runInContext(helper, context);
  let index = 0;
  const cleanup = context.createViewportAutoplay(element, () => index++);
  return { context, element, document, motion, timers, observer, cleanup, index: () => index, tick: () => [...timers.values()].forEach(fn => fn()) };
}

test('off-screen carousels stay at first slide, pause at current slide, and resume', () => {
  const h = setup();
  h.tick();
  assert.equal(h.index(), 0);
  h.observer.show(.1);
  assert.equal(h.timers.size, 0);
  h.observer.show(.5);
  h.tick();
  assert.equal(h.index(), 1);
  h.observer.show(0);
  h.tick();
  assert.equal(h.index(), 1);
  h.observer.show(.5);
  h.tick();
  assert.equal(h.index(), 2);
});

test('visibility, reduced motion, hover and keyboard focus all gate playback', () => {
  const h = setup();
  h.observer.show(1);
  for (const [target, key, event] of [[h.document, 'hidden', 'visibilitychange'], [h.motion, 'matches', 'change']]) {
    target[key] = true; target.emit(event); assert.equal(h.timers.size, 0);
    target[key] = false; target.emit(event); assert.equal(h.timers.size, 1);
  }
  h.element.emit('pointerenter', { pointerType: 'touch' });
  assert.equal(h.timers.size, 1);
  h.element.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(h.timers.size, 0);
  h.element.emit('focusin');
  h.element.emit('pointerleave');
  assert.equal(h.timers.size, 0);
  h.element.emit('focusout', { relatedTarget: h.element });
  assert.equal(h.timers.size, 0);
  h.element.emit('focusout', { relatedTarget: null });
  assert.equal(h.timers.size, 1);
  h.cleanup();
  assert.equal(h.timers.size, 0);
  assert.equal(h.observer.disconnected, true);
  assert.equal(h.document.listeners.size, 0);
});

test('Flickity autoplay respects disabled settings and single-slide carousels', () => {
  const h = setup();
  h.cleanup();
  h.element.flickity = { cells: [{}, {}] };
  h.context.initializeFlickityAutoplay(h.element);
  assert.equal(h.element.stopViewportAutoplay, null);
  h.element.dataset.autoplay = 'true';
  h.element.flickity.cells = [{}];
  h.context.initializeFlickityAutoplay(h.element);
  assert.equal(h.element.stopViewportAutoplay, null);
});
