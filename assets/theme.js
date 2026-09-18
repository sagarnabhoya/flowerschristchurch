function beginPending(control, label) {
  if (!control || control.dataset.requestPending === 'true') return;
  control.dataset.requestPending = 'true';
  control.dataset.pendingWasDisabled = String(control.disabled);
  control.dataset.pendingLabel = control.textContent;
  control.disabled = true;
  if (label) control.textContent = label;
}

function endPending(control) {
  if (!control || control.dataset.requestPending !== 'true') return;
  control.disabled = control.dataset.pendingWasDisabled === 'true';
  if (control.dataset.pendingLabel !== undefined) control.textContent = control.dataset.pendingLabel;
  delete control.dataset.requestPending;
  delete control.dataset.pendingWasDisabled;
  delete control.dataset.pendingLabel;
}

function resetTransientUi() {
  document.querySelectorAll('[data-request-pending="true"]').forEach(endPending);
  document.querySelectorAll('.is-loading').forEach((element) => element.classList.remove('is-loading'));
  document.body.classList.remove('no-scroll');
}

window.addEventListener('pageshow', resetTransientUi);

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
    this.dialog.classList.remove('is-closing');
    this.dialog.showModal();
    document.body.classList.add('no-scroll');
    if (this.dialog.id === 'os-search-overlay') window.requestAnimationFrame(() => this.dialog.querySelector('input[type="search"]')?.focus({ preventScroll: true }));
  }
  close() {
    if (this.dialog.id !== 'db-mobile-menu' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.dialog.close();
      document.body.classList.remove('no-scroll');
      return;
    }
    if (this.dialog.classList.contains('is-closing')) return;
    this.dialog.classList.add('is-closing');
    window.setTimeout(() => {
      this.dialog.close();
      this.dialog.classList.remove('is-closing');
      document.body.classList.remove('no-scroll');
    }, 280);
  }
}

document.querySelectorAll('[data-dialog-trigger]').forEach((trigger) => new BloomDialog(trigger));

class OsPredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-predictive-input]');
    this.results = this.querySelector('[data-predictive-results]');
    this.status = this.querySelector('[data-predictive-status]');
    this.abortController = null;
    this.timer = null;
    this.input?.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.search(this.input.value.trim()), 180);
    });
  }
  async search(term) {
    if (term.length < 2) { this.results.innerHTML = ''; this.status.textContent = ''; return; }
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.status.textContent = 'Searching…';
    try {
      const root = window.Shopify?.routes?.root || '/';
      const response = await fetch(`${root}search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product&resources[limit]=8&resources[options][unavailable_products]=last`, { signal: this.abortController.signal });
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      const products = data.resources?.results?.products || [];
      this.status.textContent = products.length ? `${products.length} suggested products` : 'No products found';
      this.results.innerHTML = products.map((product) => `<a class="os-predictive-card" href="${escapeHtml(product.url)}">${product.image ? `<img src="${escapeHtml(product.image)}&width=360" alt="" width="180" height="220">` : ''}<span><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.price || '')}</small></span></a>`).join('');
    } catch (error) { if (error.name !== 'AbortError') this.status.textContent = 'Search is temporarily unavailable'; }
  }
}
if (!customElements.get('os-predictive-search')) customElements.define('os-predictive-search', OsPredictiveSearch);

class OsFaq extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.items = [...this.querySelectorAll('details')];
    if (this.dataset.accordionMode !== 'single') return;
    this.items.forEach((item) => item.addEventListener('toggle', () => {
      if (!item.open) return;
      this.items.forEach((other) => { if (other !== item) other.open = false; });
    }));
  }
}
if (!customElements.get('os-faq')) customElements.define('os-faq', OsFaq);

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
  if (!drawer) return false;
  if (!drawer.open) drawer.showModal();
  document.body.classList.add('no-scroll');
  return true;
}

function updateProductVariant(form, variant) {
  if (!form) return;
  const selectedVariant = form.querySelector('[data-selected-variant]');
  const submit = form.querySelector('[data-product-submit]');
  if (!variant) {
    if (selectedVariant) selectedVariant.value = '';
    if (submit) { submit.disabled = true; submit.textContent = 'Unavailable'; }
    return;
  }
  const available = variant.available === true || variant.dataset?.available === 'true';
  const price = form.closest('.db-product')?.querySelector('[data-product-price]') || document.querySelector('[data-product-price]');
  if (selectedVariant) selectedVariant.value = variant.id || variant.value;
  if (price) price.textContent = variant.price !== undefined ? formatCartMoney(variant.price, window.Shopify?.currency?.active || document.documentElement.dataset.currency || 'NZD') : variant.dataset?.price;
  if (submit) { submit.disabled = !available; submit.textContent = available ? 'Add to cart' : 'Sold out'; }
  const imageId = variant.featured_image?.id || variant.featured_media?.id || variant.dataset?.imageId;
  if (imageId) document.querySelector(`[data-media-id="${CSS.escape(String(imageId))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const variantId = variant.id || variant.value;
  if (variantId) { const url = new URL(window.location.href); url.searchParams.set('variant', variantId); window.history.replaceState({}, '', url); }
}

document.addEventListener('change', (event) => {
  const optionInput = event.target.closest('[data-product-option]');
  if (optionInput) {
    const form = optionInput.closest('[data-product-builder-form]');
    let variants = [];
    try { variants = JSON.parse(form?.querySelector('[data-product-variants]')?.textContent || '[]'); } catch (_) {}
    const selectedOptions = [...form.querySelectorAll('[data-product-option]:checked')].map((input) => input.value);
    const variant = variants.find((entry) => entry.options?.every((value, index) => value === selectedOptions[index]));
    updateProductVariant(form, variant);
    return;
  }
  const select = event.target.closest('[data-variant-select]');
  if (!select) return;
  const option = select.selectedOptions?.[0] || select;
  updateProductVariant(select.closest('[data-product-builder-form]'), option);
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
    beginPending(button, 'Adding your selections…');
    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.description || 'One of these selections is no longer available.'); }
      await refreshCartDrawer(); if (!openCartDrawer()) { window.location.assign(`${window.Shopify.routes.root}cart`); return; }
      if (button) { endPending(button); button.textContent = 'Added to cart'; setTimeout(() => { button.textContent = originalLabel; }, 1800); }
    } catch (error) {
      if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; } else alert(error.message);
      endPending(button);
    }
    return;
  }

  const form = event.target.closest('[data-ajax-product-form]');
  if (!form || !window.fetch) return;
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  const label = button?.textContent;
  beginPending(button, 'Adding…');
  try {
    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    if (!response.ok) throw new Error('Unable to add this item.');
    await refreshCartDrawer(); if (!openCartDrawer()) { window.location.assign(`${window.Shopify.routes.root}cart`); return; }
    endPending(button);
  } catch (error) {
    alert(error.message);
    endPending(button);
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
    beginPending(removeButton);
    const response = await fetch(`${window.Shopify.routes.root}cart/change.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: removeButton.dataset.cartRemove, quantity: 0 }) });
    if (response.ok) await refreshCartDrawer();
    else endPending(removeButton);
    return;
  }

  const giftButton = event.target.closest('[data-cart-addon]');
  if (!giftButton || !window.fetch) return;
  const originalLabel = giftButton.textContent;
  beginPending(giftButton, 'Adding…');
  try {
    const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: Number(giftButton.dataset.cartAddon), quantity: 1 }] }) });
    if (!response.ok) throw new Error('This gift is no longer available.');
    window.location.reload();
  } catch (error) {
    alert(error.message);
    endPending(giftButton);
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
    if (this.ready || !window.Flickity) return;
    this.ready = true;
    this.track = this.querySelector('[data-carousel-track]');
    this.slides = [...this.querySelectorAll('[data-carousel-slide]')];
    if (!this.track || !this.slides.length) return;
    this.previousButton = this.querySelector('[data-carousel-prev]');
    this.nextButton = this.querySelector('[data-carousel-next]');
    this.current = this.querySelector('[data-carousel-current]');
    this.progress = this.querySelector('[data-carousel-progress]');
    this.mediaQuery = matchMedia('(max-width: 749px)');
    this.handleLayoutChange = () => this.updateLayout();
    this.mediaQuery.addEventListener('change', this.handleLayoutChange);
    this.previousButton?.addEventListener('click', () => this.flickity?.previous());
    this.nextButton?.addEventListener('click', () => this.flickity?.next());
    this.updateLayout();
    this.querySelectorAll('img').forEach((image) => {
      if (!image.complete) image.addEventListener('load', () => this.flickity?.resize(), { once: true });
    });
  }

  updateLayout() {
    const centered = this.mediaQuery.matches ? this.dataset.mobileCentered === 'true' : this.dataset.desktopCentered === 'true';
    if (this.flickity && this.carouselMode === centered) return;
    const selectedIndex = this.flickity?.selectedIndex || 0;
    this.flickity?.destroy();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.classList.toggle('is-centered', centered);
    this.flickity = new Flickity(this.track, {
      cellSelector: '[data-carousel-slide]',
      initialIndex: Math.min(selectedIndex, this.slides.length - 1),
      cellAlign: centered ? 'center' : 'left',
      contain: !centered,
      draggable: this.slides.length > 1,
      wrapAround: this.slides.length > 1,
      prevNextButtons: false,
      pageDots: false,
      adaptiveHeight: false,
      autoPlay: this.dataset.autoplay === 'true' && !reduceMotion ? Number(this.dataset.interval) || 6000 : false,
      pauseAutoPlayOnHover: true,
      accessibility: true
    });
    this.carouselMode = centered;
    this.flickity.on('change', (index) => this.updateControls(index));
    this.updateControls(this.flickity.selectedIndex);
  }

  updateControls(index) {
    const current = index + 1;
    if (this.current) this.current.textContent = current;
    if (this.progress) this.progress.style.transform = `scaleX(${current / this.slides.length})`;
    const disabled = this.slides.length < 2;
    if (this.previousButton) this.previousButton.disabled = disabled;
    if (this.nextButton) this.nextButton.disabled = disabled;
  }

  disconnectedCallback() {
    this.mediaQuery?.removeEventListener('change', this.handleLayoutChange);
    this.flickity?.destroy();
    this.flickity = null;
  }
}

if (!customElements.get('os-image-carousel')) customElements.define('os-image-carousel', OsImageCarousel);

class OsProductCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-product-carousel-track]');
    this.slides = [...this.querySelectorAll('[data-product-carousel-slide]')];
    if (!this.track || !this.slides.length) return;
    this.mediaQuery = window.matchMedia('(max-width: 749px)');
    this.handleLayoutChange = () => this.updateLayout();
    this.handleBlockSelect = (event) => {
      const slide = event.target.closest('[data-product-carousel-slide]');
      if (slide) this.flickity?.selectCell(slide);
    };
    this.mediaQuery.addEventListener('change', this.handleLayoutChange);
    this.addEventListener('shopify:block:select', this.handleBlockSelect);
    this.updateLayout();
  }

  updateLayout() {
    const isMobile = this.mediaQuery.matches;
    const layout = isMobile ? this.dataset.mobileLayout : this.dataset.desktopLayout;
    const centered = isMobile ? this.dataset.mobileCentered === 'true' : this.dataset.desktopCentered === 'true';
    this.classList.toggle('is-grid', layout === 'grid');
    this.classList.toggle('is-slider', layout === 'slider');
    this.classList.toggle('is-centered', centered);
    const mode = `${layout}-${centered}`;
    if (layout === 'grid') {
      this.lastSelectedIndex = this.flickity?.selectedIndex ?? this.lastSelectedIndex;
      this.flickity?.destroy();
      this.flickity = null;
      this.carouselMode = mode;
      return;
    }
    if (this.flickity && this.carouselMode === mode) return;
    this.lastSelectedIndex = this.flickity?.selectedIndex ?? this.lastSelectedIndex;
    this.flickity?.destroy();
    this.flickity = null;
    if (!window.Flickity) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const requestedIndex = this.lastSelectedIndex ?? (Number(this.dataset.initialIndex) || 0);
    this.flickity = new Flickity(this.track, {
      cellSelector: '[data-product-carousel-slide]',
      initialIndex: Math.min(Math.max(requestedIndex, 0), this.slides.length - 1),
      cellAlign: centered ? 'center' : 'left',
      contain: !centered,
      draggable: this.slides.length > 1,
      wrapAround: this.slides.length > 1,
      prevNextButtons: false,
      pageDots: false,
      adaptiveHeight: false,
      autoPlay: this.dataset.autoplay === 'true' && !reduceMotion ? Number(this.dataset.interval) || 6000 : false,
      pauseAutoPlayOnHover: true,
      accessibility: true
    });
    this.carouselMode = mode;
    const previousButton = this.querySelector('[data-product-carousel-prev]');
    const nextButton = this.querySelector('[data-product-carousel-next]');
    if (previousButton) previousButton.onclick = () => this.flickity?.previous();
    if (nextButton) nextButton.onclick = () => this.flickity?.next();
    this.progress = this.querySelector('[data-product-carousel-progress] span');
    this.updateProgress(this.flickity.selectedIndex);
    this.updateNavigationState();
    this.flickity.on('change', (index) => {
      this.updateProgress(index);
      this.updateNavigationState();
    });
    this.querySelectorAll('img').forEach((image) => {
      if (!image.complete) image.addEventListener('load', () => this.flickity?.resize(), { once: true });
    });
  }

  updateProgress(index) {
    if (this.progress) this.progress.style.transform = `scaleX(${(index + 1) / this.slides.length})`;
  }

  updateNavigationState() {
    const disabled = this.slides.length < 2;
    this.querySelectorAll('[data-product-carousel-prev], [data-product-carousel-next]').forEach((button) => { button.disabled = disabled; });
  }

  disconnectedCallback() {
    this.mediaQuery?.removeEventListener('change', this.handleLayoutChange);
    this.removeEventListener('shopify:block:select', this.handleBlockSelect);
    this.flickity?.destroy();
    this.flickity = null;
  }
}

if (!customElements.get('os-product-carousel')) customElements.define('os-product-carousel', OsProductCarousel);

class OsBlogList extends HTMLElement {
  connectedCallback() {
    if (this.dataset.layout !== 'slider' || this.flickity || !window.Flickity) return;
    this.track = this.querySelector('[data-blog-track]');
    this.cards = [...this.querySelectorAll('[data-blog-card]')];
    if (!this.track || !this.cards.length) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.flickity = new Flickity(this.track, {
      cellSelector: '[data-blog-card]',
      cellAlign: 'left',
      contain: true,
      draggable: this.cards.length > 1,
      wrapAround: this.cards.length > 2,
      prevNextButtons: false,
      pageDots: this.dataset.dots === 'true',
      imagesLoaded: true,
      adaptiveHeight: false,
      autoPlay: this.dataset.autoplay === 'true' && !reduceMotion ? Number(this.dataset.interval) || 5000 : false,
      pauseAutoPlayOnHover: true,
      accessibility: true
    });
    this.querySelector('[data-blog-prev]')?.addEventListener('click', () => this.flickity.previous());
    this.querySelector('[data-blog-next]')?.addEventListener('click', () => this.flickity.next());
    this.addEventListener('shopify:block:select', (event) => {
      const card = event.target.closest('[data-blog-card]');
      if (card) this.flickity.selectCell(card);
    });
  }

  disconnectedCallback() {
    this.flickity?.destroy();
    this.flickity = null;
  }
}

if (!customElements.get('os-blog-list')) customElements.define('os-blog-list', OsBlogList);

class OsSocialGallery extends HTMLElement {
  connectedCallback() {
    if (this.initialized || !window.Flickity) return;
    this.initialized = true;
    this.track = this.querySelector('[data-social-gallery-track]');
    this.cards = [...this.querySelectorAll('[data-social-card]')];
    this.modal = this.querySelector('[data-social-modal]');
    this.modalSlides = [...this.querySelectorAll('[data-social-modal-slide]')];
    if (!this.track || !this.cards.length || !this.modal) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.flickity = new Flickity(this.track, {
      cellSelector: '[data-social-card]',
      cellAlign: 'left',
      contain: false,
      draggable: this.cards.length > 1,
      wrapAround: this.cards.length > 1,
      prevNextButtons: false,
      pageDots: false,
      autoPlay: this.dataset.autoplay === 'true' && !reduceMotion ? Number(this.dataset.interval) || 6000 : false,
      pauseAutoPlayOnHover: true,
      accessibility: true
    });
    this.querySelector('[data-social-gallery-prev]')?.addEventListener('click', () => this.flickity.previous());
    this.querySelector('[data-social-gallery-next]')?.addEventListener('click', () => this.flickity.next());
    this.cards.forEach((card) => card.addEventListener('click', () => this.openPost(Number(card.dataset.socialIndex) || 0)));
    this.querySelector('[data-social-modal-close]')?.addEventListener('click', () => this.modal.close());
    this.querySelector('[data-social-modal-prev]')?.addEventListener('click', () => this.openPost(this.currentIndex - 1));
    this.querySelector('[data-social-modal-next]')?.addEventListener('click', () => this.openPost(this.currentIndex + 1));
    this.modal.addEventListener('click', (event) => { if (event.target === this.modal) this.modal.close(); });
    this.modal.addEventListener('close', () => this.closePost());
    this.addEventListener('shopify:block:select', (event) => {
      const card = event.target.closest('[data-social-card]');
      if (card) this.flickity.selectCell(card);
    });
  }

  openPost(index) {
    if (!this.modalSlides.length) return;
    this.currentIndex = (index + this.modalSlides.length) % this.modalSlides.length;
    this.modalSlides.forEach((slide, slideIndex) => {
      const active = slideIndex === this.currentIndex;
      slide.hidden = !active;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      const video = slide.querySelector('video');
      if (!video) return;
      if (active && this.dataset.autoplayVideo === 'true') video.play().catch(() => {});
      else video.pause();
    });
    if (!this.modal.open) this.modal.showModal();
    document.body.classList.add('no-scroll');
  }

  closePost() {
    document.body.classList.remove('no-scroll');
    this.modal.querySelectorAll('video').forEach((video) => video.pause());
  }

  disconnectedCallback() {
    this.flickity?.destroy();
    this.flickity = null;
    this.closePost();
  }
}

if (!customElements.get('os-social-gallery')) customElements.define('os-social-gallery', OsSocialGallery);

class OsCartCarousel extends HTMLElement {
  connectedCallback() {
    if (this.flickity || !window.Flickity) return;
    const track = this.querySelector('[data-cart-carousel-track]');
    const cells = this.querySelectorAll('[data-cart-carousel-cell]');
    if (!track || !cells.length) return;
    this.flickity = new Flickity(track, { cellSelector: '[data-cart-carousel-cell]', cellAlign: 'left', contain: true, draggable: cells.length > 1, prevNextButtons: false, pageDots: false, groupCells: false, accessibility: true });
    this.querySelector('[data-cart-carousel-prev]')?.addEventListener('click', () => this.flickity.previous());
    this.querySelector('[data-cart-carousel-next]')?.addEventListener('click', () => this.flickity.next());
    this.querySelectorAll('img').forEach((image) => { if (!image.complete) image.addEventListener('load', () => this.flickity?.resize(), { once: true }); });
  }
  disconnectedCallback() { this.flickity?.destroy(); this.flickity = null; }
}
if (!customElements.get('os-cart-carousel')) customElements.define('os-cart-carousel', OsCartCarousel);

class OsWhySlider extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.track = this.querySelector('[data-why-track]');
    this.slides = [...this.querySelectorAll('.os-why__item')];
    this.current = this.querySelector('[data-why-current]');
    this.progress = this.querySelector('[data-why-progress]');
    this.previousButton = this.querySelector('[data-why-prev]');
    this.nextButton = this.querySelector('[data-why-next]');
    this.media = matchMedia('(max-width: 749px)');
    this.style.setProperty('--os-why-slides', this.slides.length || 1);
    this.querySelector('[data-why-prev]')?.addEventListener('click', () => this.flickity?.previous());
    this.querySelector('[data-why-next]')?.addEventListener('click', () => this.flickity?.next());
    this.onMediaChange = () => this.media.matches ? this.mount() : this.unmount();
    this.media.addEventListener?.('change', this.onMediaChange);
    this.onMediaChange();
    this.addEventListener('shopify:block:select', (event) => {
      const slide = event.target.closest('.os-why__item');
      if (slide && this.flickity) this.flickity.selectCell(slide);
    });
  }

  mount() {
    if (this.flickity || !this.track || !this.slides.length || !window.Flickity) return;
    this.flickity = new Flickity(this.track, {
      cellSelector: '.os-why__item', cellAlign: 'left', contain: false,
      draggable: this.slides.length > 1, wrapAround: false,
      prevNextButtons: false, pageDots: false, accessibility: true
    });
    this.flickity.on('select', () => this.update());
    this.update();
  }

  update() {
    const index = (this.flickity?.selectedIndex || 0) + 1;
    if (this.current) this.current.textContent = String(index).padStart(2, '0');
    if (this.progress) this.progress.style.transform = `scaleX(${index / this.slides.length})`;
    if (this.previousButton) this.previousButton.disabled = index === 1;
    if (this.nextButton) this.nextButton.disabled = index === this.slides.length;
  }

  unmount() {
    this.flickity?.destroy();
    this.flickity = null;
  }

  disconnectedCallback() {
    this.media?.removeEventListener?.('change', this.onMediaChange);
    this.unmount();
  }
}
if (!customElements.get('os-why-slider')) customElements.define('os-why-slider', OsWhySlider);

class OsCartPage extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.form = this.querySelector('[data-cart-form]');
    this.status = this.querySelector('[data-cart-status]');
    this.addEventListener('click', (event) => this.onClick(event));
    this.addEventListener('change', (event) => this.onChange(event));
    this.message = this.querySelector('[data-message-input]');
    this.message?.addEventListener('input', () => this.updateMessage());
    this.updateMessage();
  }
  async request(path, body) {
    this.classList.add('is-loading');
    try {
      const response = await fetch(`${window.Shopify.routes.root}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error((await response.json()).description || 'Unable to update your cart.');
      window.location.reload();
    } catch (error) {
      if (this.status) this.status.textContent = error.message;
      this.classList.remove('is-loading');
    }
  }
  cartAttributes() {
    if (!this.form) return {};
    const data = new FormData(this.form), attributes = {};
    for (const [name, value] of data.entries()) if (name.startsWith('attributes[')) attributes[name.slice(11, -1)] = value;
    return { attributes, note: data.get('note') || '' };
  }
  async persistDetails() {
    if (!this.form) return;
    await fetch(`${window.Shopify.routes.root}cart/update.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(this.cartAttributes()) });
  }
  async onClick(event) {
    const quantity = event.target.closest('[data-cart-quantity]');
    if (quantity) {
      const item = quantity.closest('[data-cart-line]'), input = item?.querySelector('input[name="updates[]"]');
      if (item && input) { await this.persistDetails(); await this.request('cart/change.js', { line: Number(item.dataset.cartLine), quantity: Math.max(0, Number(input.value) + Number(quantity.dataset.cartQuantity)) }); }
      return;
    }
    const remove = event.target.closest('[data-cart-remove]');
    if (remove) { const item = remove.closest('[data-cart-line]'); if (item) { await this.persistDetails(); await this.request('cart/change.js', { line: Number(item.dataset.cartLine), quantity: 0 }); } return; }
    const addon = event.target.closest('button[data-cart-addon]');
    if (addon) { beginPending(addon); await this.persistDetails(); await this.request('cart/add.js', { items: [{ id: Number(addon.dataset.cartAddon), quantity: 1 }] }); return; }
    const emoji = event.target.closest('[data-message-emoji]');
    if (emoji && this.message) { const start = this.message.selectionStart, end = this.message.selectionEnd; this.message.setRangeText(emoji.dataset.messageEmoji, start, end, 'end'); this.message.dispatchEvent(new Event('input')); this.message.focus(); return; }
    if (event.target.closest('[data-message-helper]')) { this.message?.focus(); this.message?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  async onChange(event) {
    const checkbox = event.target.closest('input[data-cart-addon]');
    if (!checkbox) return;
    beginPending(checkbox);
    await this.persistDetails();
    if (checkbox.checked) await this.request('cart/add.js', { items: [{ id: Number(checkbox.dataset.cartAddon), quantity: 1 }] });
    else {
      try {
        const cart = await fetch(`${window.Shopify.routes.root}cart.js`).then((response) => response.json());
        const item = cart.items.find((entry) => entry.variant_id === Number(checkbox.dataset.cartAddon));
        if (item) await this.request('cart/change.js', { id: item.key, quantity: 0 }); else endPending(checkbox);
      } catch (error) { if (this.status) this.status.textContent = 'Unable to update your cart.'; endPending(checkbox); }
    }
  }
  updateMessage() {
    if (!this.message) return;
    const count = this.querySelector('[data-message-count]'), preview = this.querySelector('[data-message-preview]');
    if (count) count.textContent = this.message.value.length;
    if (preview) preview.textContent = this.message.value || preview.dataset.empty || '';
  }
}
if (!customElements.get('os-cart-page')) customElements.define('os-cart-page', OsCartPage);

class OsDeliveryChecker extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.input = this.querySelector('[data-delivery-input]');
    this.search = this.querySelector('[data-delivery-search]');
    this.found = this.querySelector('[data-delivery-found]');
    this.message = this.querySelector('[data-delivery-message]');
    this.location = this.querySelector('[data-delivery-location]');
    this.cutoff = this.querySelector('[data-delivery-cutoff]');
    this.fee = this.querySelector('[data-delivery-fee]');
    this.feeWrap = this.querySelector('[data-delivery-fee-wrap]');
    this.link = this.querySelector('[data-delivery-link]');
    try { this.zones = JSON.parse(this.querySelector('[data-delivery-zones]')?.textContent || '[]'); } catch (_) { this.zones = []; }
    this.querySelector('[data-delivery-submit]')?.addEventListener('click', () => this.submit());
    this.querySelector('[data-delivery-edit]')?.addEventListener('click', () => this.edit());
    this.input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); this.submit(); } });
    try {
      const saved = localStorage.getItem(this.dataset.storageKey);
      if (saved) this.show(JSON.parse(saved));
    } catch (_) {}
  }
  submit() {
    const query = this.input?.value.trim().toLowerCase();
    if (!query) { this.input?.focus(); return; }
    const zone = this.zones.find((item) => {
      const postcodes = String(item.postcodes || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
      return postcodes.includes(query) || String(item.location || '').toLowerCase().includes(query);
    });
    if (!zone) {
      this.message.textContent = this.dataset.notFound;
      this.message.hidden = false;
      this.found.hidden = true;
      this.link.hidden = true;
      this.feeWrap.hidden = true;
      return;
    }
    this.show(zone);
    try { localStorage.setItem(this.dataset.storageKey, JSON.stringify(zone)); } catch (_) {}
  }
  show(zone) {
    this.search.hidden = true;
    this.message.hidden = true;
    this.found.hidden = false;
    this.location.textContent = zone.location;
    this.cutoff.textContent = zone.cutoff || '';
    this.link.href = zone.url || '#';
    this.link.hidden = !zone.cutoff;
    this.fee.textContent = zone.fee || '';
    this.feeWrap.hidden = !zone.fee;
  }
  edit() {
    this.search.hidden = false;
    this.found.hidden = true;
    this.link.hidden = true;
    this.feeWrap.hidden = true;
    this.message.hidden = true;
    try { localStorage.removeItem(this.dataset.storageKey); } catch (_) {}
    this.input?.focus();
  }
}
if (!customElements.get('os-delivery-checker')) customElements.define('os-delivery-checker', OsDeliveryChecker);

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

function initializeLocationRoute(section) {
  if (section.dataset.routeReady === 'true') return;
  section.dataset.routeReady = 'true';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('is-route-visible');
    return;
  }
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    section.classList.add('is-route-visible');
    observer.disconnect();
  }, { threshold: .3 });
  observer.observe(section);
}

function initializeReferenceHomepage(root = document) {
  root.querySelectorAll('[data-carousel]').forEach(initializeEditorialCarousel);
  root.querySelectorAll('[data-vertical-rotator]').forEach(initializeVerticalRotator);
  root.querySelectorAll('.os-locations').forEach(initializeLocationRoute);
}

initializeReferenceHomepage();
document.addEventListener('shopify:section:load', (event) => initializeReferenceHomepage(event.target));
