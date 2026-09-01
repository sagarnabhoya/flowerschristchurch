class BloomDialog {
  constructor(trigger) {
    this.trigger = trigger;
    this.dialog = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!this.dialog) return;
    trigger.addEventListener('click', () => this.open());
    this.dialog.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => this.close()));
    this.dialog.addEventListener('click', (event) => { if (event.target === this.dialog) this.close(); });
    this.dialog.addEventListener('close', () => document.body.classList.remove('no-scroll'));
  }
  async open() {
    if (this.dialog.id === 'db-cart-drawer') await refreshCartDrawer();
    this.dialog.showModal();
    document.body.classList.add('no-scroll');
    if (this.dialog.id === 'db-search') window.requestAnimationFrame(() => this.dialog.querySelector('input[type="search"]')?.focus({ preventScroll: true }));
  }
  close() { this.dialog.close(); document.body.classList.remove('no-scroll'); }
}

document.querySelectorAll('[data-dialog-trigger]').forEach((trigger) => new BloomDialog(trigger));

document.querySelectorAll('[data-delivery-date]').forEach((input) => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  input.min = today.toISOString().slice(0, 10);
});

document.querySelectorAll('[data-product-gallery]').forEach((gallery) => {
  const section = gallery.closest('[data-product-section]');
  const slides = [...gallery.querySelectorAll('[data-media-id], .db-product__media')];
  const current = section?.querySelector('[data-gallery-current]');
  const move = (direction) => {
    const index = Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1));
    const next = Math.min(Math.max(index + direction, 0), slides.length - 1);
    slides[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };
  section?.querySelector('[data-gallery-previous]')?.addEventListener('click', () => move(-1));
  section?.querySelector('[data-gallery-next]')?.addEventListener('click', () => move(1));
  gallery.addEventListener('scroll', () => {
    if (current) current.textContent = Math.min(Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1)) + 1, slides.length);
  }, { passive: true });
});

const editorialHeader = document.querySelector('.db-header');
if (editorialHeader) {
  const headerShell = editorialHeader.closest('.shopify-section-group-header-group');
  let condensed = window.scrollY > 220;
  let headerFrame;
  const updateHeader = () => {
    headerFrame = undefined;
    if (!condensed && window.scrollY > 220) condensed = true;
    if (condensed && window.scrollY < 48) condensed = false;
    editorialHeader.classList.toggle('is-condensed', condensed);
    headerShell?.classList.toggle('is-condensed', condensed);
  };
  updateHeader();
  window.addEventListener('scroll', () => {
    if (!headerFrame) headerFrame = window.requestAnimationFrame(updateHeader);
  }, { passive: true });
}

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
const formatCartMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(document.documentElement.lang || 'en-NZ', { style: 'currency', currency }).format(amount / 100); }
  catch (_) { return (amount / 100).toFixed(2); }
};

async function refreshCartDrawer() {
  const target = document.querySelector('[data-cart-drawer-content]');
  if (!target || !window.fetch) return null;
  const response = await fetch(`${window.Shopify.routes.root}cart.js`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const cart = await response.json();
  document.querySelectorAll('.db-cart-count').forEach((count) => { count.textContent = cart.item_count; count.hidden = cart.item_count === 0; });
  const cartButton = document.querySelector('[aria-controls="db-cart-drawer"]');
  let count = cartButton?.querySelector('.db-cart-count');
  if (cart.item_count > 0 && cartButton && !count) {
    count = document.createElement('span'); count.className = 'db-cart-count'; cartButton.append(count); count.textContent = cart.item_count;
  }
  if (cart.item_count === 0) {
    target.innerHTML = '<div class="db-cart-drawer__empty"><h3>Ready to brighten their day?</h3><p>Your cart is currently empty. Choose something beautiful and we’ll take care of the rest.</p><a class="db-button" href="/collections/all">Shop blooms</a></div>';
    return cart;
  }
  const items = cart.items.map((item) => {
    const image = item.featured_image?.url || item.image;
    const resizedImage = image ? `${image}${image.includes('?') ? '&' : '?'}width=180` : '';
    return `<div class="db-drawer-item">${image ? `<img src="${escapeHtml(resizedImage)}" alt="${escapeHtml(item.product_title)}" width="90" height="90">` : ''}<div><a href="${escapeHtml(item.url)}">${escapeHtml(item.product_title)}</a><p>${item.quantity} &times; ${formatCartMoney(item.final_price, cart.currency)}</p><button class="db-text-link" type="button" data-cart-remove="${escapeHtml(item.key)}">Remove</button></div></div>`;
  }).join('');
  target.innerHTML = `<div class="db-cart-drawer__items">${items}</div><div class="db-cart-drawer__footer"><p class="db-cart-drawer__total"><span>Subtotal</span><span>${formatCartMoney(cart.total_price, cart.currency)}</span></p><p class="db-cart-drawer__note">Delivery and your personal message are confirmed in the next step.</p><a class="db-button" href="${window.Shopify.routes.root}cart">Continue to delivery</a><button class="db-cart-drawer__continue" type="button" data-dialog-close>Continue shopping</button></div>`;
  return cart;
}

function openCartDrawer() {
  const drawer = document.getElementById('db-cart-drawer');
  if (drawer && !drawer.open) drawer.showModal();
  document.body.classList.add('no-scroll');
}

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-variant-select]');
  if (!select) return;
  const option = select.selectedOptions[0];
  const form = select.closest('[data-product-builder-form]');
  const available = option.dataset.available === 'true';
  const price = document.querySelector('[data-product-price]');
  const submit = form?.querySelector('[data-product-submit]');
  if (price) price.textContent = option.dataset.price;
  if (submit) { submit.disabled = !available; submit.textContent = available ? 'Add to cart' : 'Sold out'; }
  if (option.dataset.imageId) document.querySelector(`[data-media-id="${CSS.escape(option.dataset.imageId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const url = new URL(window.location.href); url.searchParams.set('variant', option.value); window.history.replaceState({}, '', url);
});

document.addEventListener('submit', async (event) => {
  const builderForm = event.target.closest('[data-product-builder-form]');
  if (builderForm && window.fetch) {
    event.preventDefault();
    const button = event.submitter || builderForm.querySelector('[type="submit"]');
    const originalLabel = button?.textContent;
    const formData = new FormData(builderForm);
    const properties = {};
    formData.forEach((value, key) => {
      const match = key.match(/^properties\[(.+)\]$/);
      if (match && value) properties[match[1]] = value;
    });
    const bundleId = `bloom-${Date.now()}`;
    properties._Bundle = bundleId;
    const items = [{ id: Number(formData.get('id')), quantity: Number(formData.get('quantity') || 1), properties }];
    builderForm.querySelectorAll('[data-addon-variant]:checked').forEach((input) => items.push({ id: Number(input.value), quantity: 1, properties: { _Bundle: bundleId, _Add_on: 'true' } }));
    const errorBox = builderForm.querySelector('[data-product-error]');
    if (errorBox) errorBox.hidden = true;
    if (button) { button.disabled = true; button.textContent = 'Adding your selections…'; }
    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.description || 'One of these selections is no longer available.'); }
      await refreshCartDrawer(); openCartDrawer();
      if (button) { button.disabled = false; button.textContent = 'Added to cart'; setTimeout(() => { button.textContent = originalLabel; }, 1800); }
    } catch (error) {
      if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; } else alert(error.message);
      if (button) { button.disabled = false; button.textContent = originalLabel; }
    }
    return;
  }

  const form = event.target.closest('[data-ajax-product-form]');
  if (!form || !window.fetch) return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  const label = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Adding…'; }
  try {
    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    if (!response.ok) throw new Error('Unable to add this item.');
    await refreshCartDrawer(); openCartDrawer();
    if (button) { button.disabled = false; button.textContent = label; }
  } catch (error) {
    alert(error.message);
    if (button) { button.disabled = false; button.textContent = label; }
  }
});

document.addEventListener('click', async (event) => {
  const socialTrigger = event.target.closest('[data-social-open]');
  if (socialTrigger) {
    const modal = document.getElementById(socialTrigger.dataset.socialOpen);
    if (modal && !modal.open) { modal.showModal(); document.body.classList.add('no-scroll'); }
    return;
  }

  const dialogClose = event.target.closest('[data-dialog-close]');
  if (dialogClose) {
    dialogClose.closest('dialog')?.close();
    document.body.classList.remove('no-scroll');
    return;
  }

  const quantityButton = event.target.closest('[data-quantity-change]');
  if (quantityButton) {
    const input = quantityButton.closest('[data-quantity]')?.querySelector('input[type="number"]');
    if (input) { input.value = Math.max(Number(input.min || 1), Number(input.value || 1) + Number(quantityButton.dataset.quantityChange)); input.dispatchEvent(new Event('change', { bubbles: true })); }
    return;
  }

  const removeButton = event.target.closest('[data-cart-remove]');
  if (removeButton) {
    removeButton.disabled = true;
    const response = await fetch(`${window.Shopify.routes.root}cart/change.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: removeButton.dataset.cartRemove, quantity: 0 }) });
    if (response.ok) await refreshCartDrawer();
    else removeButton.disabled = false;
    return;
  }

  const giftButton = event.target.closest('[data-cart-addon]');
  if (!giftButton || !window.fetch) return;
  const originalLabel = giftButton.textContent;
  giftButton.disabled = true;
  giftButton.textContent = 'Adding…';
  try {
    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: Number(giftButton.dataset.cartAddon), quantity: 1 }] }) });
    if (!response.ok) throw new Error('This gift is no longer available.');
    window.location.reload();
  } catch (error) {
    alert(error.message);
    giftButton.disabled = false;
    giftButton.textContent = originalLabel;
  }
});

function initializeEditorialCarousel(carousel) {
  if (carousel.dataset.carouselReady === 'true') return;
  carousel.dataset.carouselReady = 'true';
  const track = carousel.querySelector('[data-carousel-track]');
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  if (!track || !slides.length) return;
  const startIndex = Math.min(Number(carousel.dataset.startIndex) || 0, slides.length - 1);
  if (startIndex > 0) window.requestAnimationFrame(() => { track.scrollLeft = Math.max(0, slides[startIndex].offsetLeft - track.clientWidth * .13); });
  const nearestIndex = () => {
    const trackBox = track.getBoundingClientRect();
    let closest = 0;
    let distance = Infinity;
    slides.forEach((slide, index) => {
      const current = Math.abs(slide.getBoundingClientRect().left - trackBox.left);
      if (current < distance) { distance = current; closest = index; }
    });
    return closest;
  };
  const move = (direction) => {
    const current = nearestIndex();
    const next = (current + direction + slides.length) % slides.length;
    slides[next].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };
  carousel.querySelector('[data-carousel-prev]')?.addEventListener('click', () => move(-1));
  carousel.querySelector('[data-carousel-next]')?.addEventListener('click', () => move(1));
  if (carousel.dataset.autoplay !== 'true' || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let timer;
  let visible = true;
  let paused = false;
  const schedule = () => {
    window.clearInterval(timer);
    if (visible && !paused) timer = window.setInterval(() => move(1), Number(carousel.dataset.interval) || 5000);
  };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: .2 }).observe(carousel);
  carousel.addEventListener('mouseenter', () => { paused = true; schedule(); });
  carousel.addEventListener('mouseleave', () => { paused = false; schedule(); });
  carousel.addEventListener('focusin', () => { paused = true; schedule(); });
  carousel.addEventListener('focusout', () => { paused = false; schedule(); });
  schedule();
}

class OsImageCarousel extends HTMLElement {
  connectedCallback() {
    if (this.flickity || !window.Flickity) return;
    this.track = this.querySelector('[data-carousel-track]');
    this.slides = [...this.querySelectorAll('[data-carousel-slide]')];
    if (!this.track || !this.slides.length) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.flickity = new Flickity(this.track, {
      cellSelector: '[data-carousel-slide]',
      cellAlign: 'center',
      contain: false,
      draggable: this.slides.length > 1,
      wrapAround: this.slides.length > 1,
      prevNextButtons: false,
      pageDots: false,
      adaptiveHeight: false,
      autoPlay: this.dataset.autoplay === 'true' && !reduceMotion ? Number(this.dataset.interval) || 6000 : false,
      pauseAutoPlayOnHover: true,
      accessibility: true
    });
    this.querySelector('[data-carousel-prev]')?.addEventListener('click', () => this.flickity.previous());
    this.querySelector('[data-carousel-next]')?.addEventListener('click', () => this.flickity.next());
    this.querySelectorAll('img').forEach((image) => {
      if (!image.complete) image.addEventListener('load', () => this.flickity?.resize(), { once: true });
    });
  }

  disconnectedCallback() {
    this.flickity?.destroy();
    this.flickity = null;
  }
}

if (!customElements.get('os-image-carousel')) customElements.define('os-image-carousel', OsImageCarousel);

function initializeVerticalRotator(rotator) {
  if (rotator.dataset.rotatorReady === 'true') return;
  rotator.dataset.rotatorReady = 'true';
  const items = [...rotator.querySelectorAll('[data-rotator-item]')];
  if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let current = 0;
  let timer;
  const rotate = () => {
    const previous = items[current];
    current = (current + 1) % items.length;
    previous.classList.add('is-leaving');
    previous.classList.remove('is-active');
    items[current].classList.add('is-active');
    window.setTimeout(() => previous.classList.remove('is-leaving'), 1100);
  };
  const observer = new IntersectionObserver(([entry]) => {
    window.clearInterval(timer);
    if (entry.isIntersecting) timer = window.setInterval(rotate, Number(rotator.dataset.interval) || 4000);
  }, { threshold: .3 });
  observer.observe(rotator);
}

function initializeReferenceHomepage(root = document) {
  root.querySelectorAll('[data-carousel]').forEach(initializeEditorialCarousel);
  root.querySelectorAll('[data-vertical-rotator]').forEach(initializeVerticalRotator);
}

initializeReferenceHomepage();
document.addEventListener('shopify:section:load', (event) => initializeReferenceHomepage(event.target));
document.querySelectorAll('.db-social-modal').forEach((modal) => modal.addEventListener('close', () => {
  document.body.classList.remove('no-scroll');
  modal.querySelectorAll('video').forEach((video) => video.pause());
}));
