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

function initializeProductGallery(gallery) {
  if (gallery.dataset.galleryReady === 'true') return;
  gallery.dataset.galleryReady = 'true';
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
  const initialImage = slides.find((slide) => slide.dataset.mediaId === section?.dataset.initialMediaId);
  if (initialImage) window.requestAnimationFrame(() => {
    gallery.scrollLeft = initialImage.offsetLeft - slides[0].offsetLeft;
    if (current) current.textContent = slides.indexOf(initialImage) + 1;
  });
}
document.querySelectorAll('[data-product-gallery]').forEach(initializeProductGallery);
document.addEventListener('shopify:section:load', (event) => {
  event.target.querySelectorAll('[data-product-gallery]').forEach(initializeProductGallery);
});

const editorialHeader = document.querySelector('.db-header');
if (editorialHeader) {
  const headerShell = editorialHeader.closest('.shopify-section-group-header-group');
  let condensed = window.scrollY > 220;
  let headerFrame;
  const updateHeader = () => {
    headerFrame = undefined;
    if (!condensed && window.scrollY > 220) condensed = true;
    // Collapsing the sticky header removes almost 200px of height and can move
    // scrollY below a larger reset threshold without any user input. Resetting
    // only at the document top prevents that layout shift from toggling the
    // header open and closed in a continuous loop.
    if (condensed && window.scrollY <= 1) condensed = false;
    editorialHeader.classList.toggle('is-condensed', condensed);
    headerShell?.classList.toggle('is-condensed', condensed);
  };
  updateHeader();
  window.addEventListener('scroll', () => {
    if (!headerFrame) headerFrame = window.requestAnimationFrame(updateHeader);
  }, { passive: true });

  const desktopNav = editorialHeader.querySelector('.db-nav');
  const dropdownItems = desktopNav ? [...desktopNav.querySelectorAll(':scope > li')].filter((item) => item.querySelector(':scope > .db-nav__panel')) : [];
  const closeDropdowns = (except) => dropdownItems.forEach((item) => {
    if (item === except) return;
    item.classList.remove('is-open');
    item.querySelector(':scope > .db-nav__trigger')?.setAttribute('aria-expanded', 'false');
  });

  dropdownItems.forEach((item) => {
    const trigger = item.querySelector(':scope > .db-nav__trigger');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.addEventListener('click', (event) => {
      event.preventDefault();
      const willOpen = !item.classList.contains('is-open');
      closeDropdowns(item);
      item.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
    });
  });

  desktopNav?.querySelectorAll(':scope > li').forEach((item) => {
    item.addEventListener('pointerenter', () => closeDropdowns(item));
  });
  document.addEventListener('click', (event) => {
    if (!desktopNav?.contains(event.target)) closeDropdowns();
  });
  editorialHeader.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdowns();
      document.activeElement?.blur();
    }
  });
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
    return `<div class="db-drawer-item${item.parent_relationship ? ' db-drawer-item--extra' : ''}">${image ? `<img src="${escapeHtml(resizedImage)}" alt="${escapeHtml(item.product_title)}" width="90" height="90">` : ''}<div><a href="${escapeHtml(item.url)}">${escapeHtml(item.product_title)}</a><p>${item.quantity} &times; ${formatCartMoney(item.final_price, cart.currency)}</p><button class="db-text-link" type="button" data-cart-remove="${escapeHtml(item.key)}">Remove</button></div></div>`;
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

function updateProductStepNumbers(form) {
  let step = 0;
  form?.querySelectorAll('.db-product-options > legend > span, .db-addon-picker > legend > span').forEach((number) => {
    if (!number.closest('[hidden]')) number.textContent = ++step;
  });
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
  if (submit && submit.dataset.requestPending !== 'true') { submit.disabled = !available; submit.textContent = available ? (submit.dataset.addToCartLabel || 'Add to cart') : 'Sold out'; }
  const imageId = variant.featured_image?.id || variant.featured_media?.id || variant.dataset?.imageId;
  if (imageId) form.closest('[data-product-section]')?.querySelector(`[data-media-id="${CSS.escape(String(imageId))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  const variantId = variant.id || variant.value;
  if (variantId) { const url = new URL(window.location.href); url.searchParams.set('variant', variantId); window.history.replaceState({}, '', url); }
}

document.addEventListener('change', (event) => {
  const addonSelect = event.target.closest('[data-addon-select]');
  if (addonSelect) {
    const card = addonSelect.closest('[data-addon-card]');
    const option = addonSelect.selectedOptions[0];
    const checkbox = card?.querySelector('[data-addon-variant]');
    if (!checkbox || !option) return;
    checkbox.value = option.value;
    checkbox.disabled = option.disabled;
    if (checkbox.disabled) checkbox.checked = false;
    card.classList.toggle('is-unavailable', checkbox.disabled);
    const price = card.querySelector('[data-addon-price]');
    if (price) price.textContent = option.dataset.price;
    const image = card.querySelector('img');
    if (image && option.dataset.image) { image.src = option.dataset.image; image.removeAttribute('srcset'); }
    return;
  }
  const addonCheckbox = event.target.closest('[data-addon-variant]');
  if (addonCheckbox?.checked) {
    const picker = addonCheckbox.closest('[data-addon-picker]');
    if (picker?.dataset.selectionMode === 'single') picker.querySelectorAll('[data-addon-variant]').forEach((input) => { if (input !== addonCheckbox) input.checked = false; });
  }
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

// Shopify native nested lines keep extras attached to this specific bouquet.
function buildProductBundleItems(formData, selectedExtras, properties) {
  const parentId = Number(formData.get('id'));
  const quantity = Number(formData.get('quantity'));
  if (!Number.isSafeInteger(parentId) || parentId <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Please select an available product and a whole quantity of at least 1.');
  const bundleId = `bloom-${crypto.randomUUID()}`;
  const items = [{ id: parentId, quantity, properties: { ...properties, _Bundle: bundleId } }];
  const included = new Set([parentId]);
  selectedExtras.forEach((input) => {
    const id = Number(input.value);
    if (input.disabled || !Number.isSafeInteger(id) || id <= 0 || included.has(id)) return;
    included.add(id);
    items.push({ id, quantity, parent_id: parentId, properties: { _Bundle: bundleId, _Add_on: 'true' } });
  });
  return items;
}

document.addEventListener('submit', async (event) => {
  const builderForm = event.target.closest('[data-product-builder-form]');
  if (builderForm && window.fetch) {
    event.preventDefault();
    if (builderForm.dataset.requestPending === 'true' || !builderForm.reportValidity()) return;
    const button = event.submitter || builderForm.querySelector('[type="submit"]');
    if (button?.disabled) return;
    builderForm.dataset.requestPending = 'true';
    builderForm.setAttribute('aria-busy', 'true');
    const formData = new FormData(builderForm);
    const properties = {};
    formData.forEach((value, key) => {
      const match = key.match(/^properties\[(.+)\]$/);
      if (match && value) properties[match[1]] = value;
    });
    const errorBox = builderForm.querySelector('[data-product-error]');
    if (errorBox) errorBox.hidden = true;
    beginPending(button, 'Adding your selections…');
    try {
      const items = buildProductBundleItems(formData, builderForm.querySelectorAll('[data-addon-variant]:checked'), properties);
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.description || 'One of these selections is no longer available.'); }
      try { await refreshCartDrawer(); } catch (_) { window.location.assign(`${window.Shopify.routes.root}cart`); return; }
      if (!openCartDrawer()) { window.location.assign(`${window.Shopify.routes.root}cart`); return; }
      endPending(button);
    } catch (error) {
      if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; } else alert(error.message);
      endPending(button);
    } finally {
      delete builderForm.dataset.requestPending;
      builderForm.removeAttribute('aria-busy');
      const variantData = builderForm.querySelector('[data-product-variants]');
      if (variantData) {
        const selectedOptions = [...builderForm.querySelectorAll('[data-product-option]:checked')].map((input) => input.value);
        const variants = JSON.parse(variantData.textContent || '[]');
        updateProductVariant(builderForm, variants.find((variant) => variant.options?.every((value, index) => value === selectedOptions[index])));
      }
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
    if (input) {
      const minimum = Number(input.min || 1);
      const maximum = input.max ? Number(input.max) : Number.MAX_SAFE_INTEGER;
      const current = input.value === '' || !Number.isFinite(Number(input.value)) ? minimum : Math.trunc(Number(input.value));
      input.value = Math.min(maximum, Math.max(minimum, current + Number(quantityButton.dataset.quantityChange)));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  // The cart page owns its requests and saves delivery details before updating.
  if (event.target.closest('os-cart-page')) return;
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
    if (!this.track || !this.modal) return;
    this.galleryAbort = new AbortController();
    this.fallbackCards = this.cards.map((card) => card.cloneNode(true));
    this.fallbackSlides = this.modalSlides.map((slide) => slide.cloneNode(true));
    this.startCarousel();
    const listenerOptions = { signal: this.galleryAbort.signal };
    this.querySelector('[data-social-gallery-prev]')?.addEventListener('click', () => this.flickity?.previous(), listenerOptions);
    this.querySelector('[data-social-gallery-next]')?.addEventListener('click', () => this.flickity?.next(), listenerOptions);
    this.track.addEventListener('click', (event) => {
      const card = event.target.closest('[data-social-card]');
      if (card) this.openPost(Number(card.dataset.socialIndex) || 0);
    }, listenerOptions);
    this.querySelector('[data-social-modal-close]')?.addEventListener('click', () => this.modal.close(), listenerOptions);
    this.querySelector('[data-social-modal-prev]')?.addEventListener('click', () => this.openPost(this.currentIndex - 1), listenerOptions);
    this.querySelector('[data-social-modal-next]')?.addEventListener('click', () => this.openPost(this.currentIndex + 1), listenerOptions);
    this.modal.addEventListener('click', (event) => { if (event.target === this.modal) this.modal.close(); }, listenerOptions);
    this.modal.addEventListener('close', () => this.closePost(), listenerOptions);
    this.addEventListener('shopify:block:select', (event) => {
      if (this.dataset.feedState === 'instagram') this.restoreFallback();
      const card = this.querySelector(`[data-social-card][data-social-index="${event.target.closest('[data-social-card]')?.dataset.socialIndex}"]`);
      if (card) this.flickity?.selectCell(card);
    }, listenerOptions);
    if (this.dataset.feedSource === 'instagram' && this.dataset.feedUrl && !window.Shopify?.designMode) this.loadInstagram();
  }

  startCarousel() {
    this.cards = [...this.track.querySelectorAll('[data-social-card]')];
    this.modalSlides = [...this.querySelectorAll('[data-social-modal-slide]')];
    this.querySelectorAll('[data-social-gallery-prev], [data-social-gallery-next], [data-social-modal-prev], [data-social-modal-next]').forEach((button) => { button.hidden = this.cards.length < 2; });
    if (!this.cards.length) return;
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
  }

  replacePosts(cards, slides) {
    if (this.modal.open) this.modal.close();
    this.closePost();
    this.flickity?.destroy();
    this.flickity = null;
    this.track.replaceChildren(...cards);
    this.querySelector('.os-social-modal__panel').replaceChildren(...slides);
    this.startCarousel();
  }

  restoreFallback() {
    this.dataset.feedState = 'fallback';
    this.replacePosts(this.fallbackCards.map((card) => card.cloneNode(true)), this.fallbackSlides.map((slide) => slide.cloneNode(true)));
  }

  async loadInstagram() {
    const signal = this.galleryAbort.signal;
    // A fetch timeout must not disable gallery controls.
    const requestAbort = new AbortController();
    signal.addEventListener('abort', () => requestAbort.abort(), { once: true });
    const timeout = setTimeout(() => requestAbort.abort(), 8000);
    try {
      const endpoint = new URL(this.dataset.feedUrl, location.origin);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || /access_token|token|secret/i.test(endpoint.search)) return;
      const response = await fetch(endpoint, { signal: requestAbort.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Feed unavailable');
      const feed = await response.json();
      if (!Array.isArray(feed.data)) throw new Error('Invalid feed');
      const limit = Math.min(24, Math.max(1, Number(this.dataset.feedLimit) || 8));
      const posts = feed.data.filter((post) => ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(post.media_type)).slice(0, limit);
      const results = await Promise.all(posts.map((post) => this.buildInstagramPost(post)));
      const valid = results.filter(Boolean);
      if (!valid.length || signal.aborted || !this.isConnected) return;
      this.dataset.feedState = 'instagram';
      this.replacePosts(valid.map((post, index) => { post.card.dataset.socialIndex = index; return post.card; }), valid.map((post) => post.slide));
    } catch (_) {
      // Server-rendered manual posts remain usable on network, auth or data errors.
    } finally {
      clearTimeout(timeout);
    }
  }

  async buildInstagramPost(post) {
    const safeUrl = (value) => {
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; }
    };
    const media = post.media_type === 'CAROUSEL_ALBUM' ? post.children?.data?.[0] : post;
    if (!media || !['IMAGE', 'VIDEO'].includes(media.media_type)) return null;
    const mediaUrl = safeUrl(media.media_url);
    const thumbnail = safeUrl(media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url);
    if (!mediaUrl || !thumbnail) return null;
    const image = new Image();
    image.src = thumbnail;
    image.alt = String(post.caption || 'Instagram post').slice(0, 300);
    image.decoding = 'async';
    const loaded = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      const done = (result) => { clearTimeout(timer); resolve(result); };
      image.onload = () => done(true);
      image.onerror = () => done(false);
      if (image.complete) done(image.naturalWidth > 0);
    });
    if (!loaded) return null;
    const element = (tag, className, text) => {
      const node = document.createElement(tag); node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const account = this.dataset.feedAccount || 'Instagram';
    const card = element('button', 'os-social-card');
    card.type = 'button'; card.dataset.socialCard = '';
    card.setAttribute('aria-label', `Open Instagram post by ${account}`);
    card.append(image);
    const overlay = element('span', `os-social-card__overlay os-social-card__overlay--${media.media_type === 'VIDEO' ? 'video' : 'post'}`);
    overlay.setAttribute('aria-hidden', 'true');
    // Static icons only; API text is always assigned with textContent.
    overlay.innerHTML = media.media_type === 'VIDEO'
      ? '<svg class="os-social-card__media-icon" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14"/><path d="m13 10 9 6-9 6z"/></svg>'
      : '<svg class="os-social-card__media-icon" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="7"/><circle cx="16" cy="16" r="6"/></svg>';
    card.append(overlay);
    const slide = element('article', 'os-social-modal__slide');
    slide.dataset.socialModalSlide = ''; slide.hidden = true;
    slide.style.setProperty('--os-social-media-fit', 'contain');
    const container = element('div', 'os-social-modal__media');
    const fullMedia = media.media_type === 'VIDEO' ? document.createElement('video') : image.cloneNode();
    if (media.media_type === 'VIDEO') {
      fullMedia.src = mediaUrl; fullMedia.poster = thumbnail;
      fullMedia.controls = true; fullMedia.playsInline = true; fullMedia.preload = 'none';
      fullMedia.addEventListener('error', () => { if (this.dataset.feedState === 'instagram') this.restoreFallback(); }, { once: true });
    }
    container.append(fullMedia);
    const copy = element('div', 'os-social-modal__copy');
    const header = document.createElement('header');
    header.append(element('span', 'os-social-modal__avatar', account.slice(0, 1).toUpperCase()), element('strong', '', account));
    copy.append(header, element('div', 'os-social-modal__caption os-social-modal__caption--api', String(post.caption || '')));
    const permalink = safeUrl(post.permalink);
    if (permalink && ['instagram.com', 'www.instagram.com'].includes(new URL(permalink).hostname)) {
      const link = element('a', 'os-social-modal__post-link', 'View on Instagram');
      link.href = permalink; link.target = '_blank'; link.rel = 'noopener noreferrer'; copy.append(link);
    }
    const date = new Date(post.timestamp);
    if (!Number.isNaN(date.getTime())) copy.append(element('p', 'os-social-modal__date', date.toLocaleDateString(document.documentElement.lang || 'en', { year: 'numeric', month: 'short', day: 'numeric' })));
    slide.append(container, copy);
    return { card, slide };
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
    this.modal?.querySelectorAll('video').forEach((video) => video.pause());
  }

  disconnectedCallback() {
    this.galleryAbort?.abort();
    this.flickity?.destroy();
    this.flickity = null;
    this.closePost();
    this.initialized = false;
  }
}

if (!customElements.get('os-social-gallery')) customElements.define('os-social-gallery', OsSocialGallery);

class OsCartCarousel extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.track = this.querySelector('[data-cart-carousel-track]');
    if (!this.track) return;
    this.controller = new AbortController();
    const options = { signal: this.controller.signal };
    this.querySelector('[data-cart-carousel-prev]')?.addEventListener('click', () => this.move(-1), options);
    this.querySelector('[data-cart-carousel-next]')?.addEventListener('click', () => this.move(1), options);
    this.track.addEventListener('scroll', () => this.updateNavigation(), { ...options, passive: true });
    const resetTarget = () => { this.scrollTarget = null; };
    this.track.addEventListener('scrollend', resetTarget, options);
    this.track.addEventListener('pointerdown', resetTarget, options);
    this.track.addEventListener('wheel', resetTarget, { ...options, passive: true });
    this.track.addEventListener('keydown', (event) => {
      if (event.target !== this.track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      this.move(event.key === 'ArrowRight' ? 1 : -1);
    }, options);
    this.resizeObserver = new ResizeObserver(() => { resetTarget(); this.updateNavigation(); });
    this.resizeObserver.observe(this.track);
    this.querySelectorAll('[data-cart-carousel-cell]').forEach((cell) => this.resizeObserver.observe(cell));
    this.updateNavigation();
  }
  move(direction) {
    const cell = this.querySelector('[data-cart-carousel-cell]');
    if (!cell) return;
    const style = getComputedStyle(this.track);
    const gap = parseFloat(style.columnGap) || 0;
    const maximum = Math.max(0, this.track.scrollWidth - this.track.clientWidth);
    const position = this.scrollTarget ?? Math.abs(this.track.scrollLeft);
    this.scrollTarget = Math.min(maximum, Math.max(0, position + direction * (cell.getBoundingClientRect().width + gap)));
    this.track.scrollTo({ left: style.direction === 'rtl' ? -this.scrollTarget : this.scrollTarget, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  updateNavigation() {
    if (!this.track) return;
    const maximum = this.track.scrollWidth - this.track.clientWidth;
    const position = Math.abs(this.track.scrollLeft);
    const previous = this.querySelector('[data-cart-carousel-prev]');
    const next = this.querySelector('[data-cart-carousel-next]');
    const navigation = this.querySelector('[data-cart-carousel-navigation]');
    if (navigation) navigation.hidden = maximum <= 1;
    if (previous) { previous.hidden = maximum <= 1; previous.disabled = position <= 1; }
    if (next) { next.hidden = maximum <= 1; next.disabled = position >= maximum - 1; }
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.resizeObserver?.disconnect();
  }
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
    const reportError = (error) => {
      if (this.status) this.status.textContent = error.message || 'Unable to update your cart.';
      this.querySelectorAll('[data-request-pending="true"]').forEach(endPending);
    };
    this.addEventListener('click', (event) => this.onClick(event).catch(reportError));
    this.addEventListener('change', (event) => this.onChange(event).catch(reportError));
    this.message = this.querySelector('[data-message-input]');
    this.message?.addEventListener('input', () => this.updateMessage());
    this.messageCreator = this.querySelector('[data-message-creator]');
    this.messageDraft = this.querySelector('[data-message-draft]');
    this.messageDraft?.addEventListener('input', () => this.updateDraftCount());
    this.messageCreator?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this.closeMessageCreator(); }
    });
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
    return { attributes, ...(data.has('note') ? { note: data.get('note') } : {}) };
  }
  async persistDetails() {
    if (!this.form) return;
    const response = await fetch(`${window.Shopify.routes.root}cart/update.js`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(this.cartAttributes()) });
    if (!response.ok) throw new Error('Unable to save your delivery details. Please try again.');
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
    if (addon) {
      if (addon.disabled || addon.dataset.requestPending === 'true') return;
      beginPending(addon, 'Adding…');
      try {
        await this.persistDetails();
        await this.request('cart/add.js', { items: [{ id: Number(addon.dataset.cartAddon), quantity: 1 }] });
      } catch (error) {
        if (this.status) this.status.textContent = error.message;
      } finally { endPending(addon); }
      return;
    }
    const emoji = event.target.closest('[data-message-emoji]');
    if (emoji && this.message) { const start = this.message.selectionStart, end = this.message.selectionEnd; this.message.setRangeText(emoji.dataset.messageEmoji, start, end, 'end'); this.message.dispatchEvent(new Event('input')); this.message.focus(); return; }
    if (event.target.closest('[data-message-helper]') && this.messageCreator && this.messageDraft && this.message) {
      if (!this.messageCreator.hidden) { this.closeMessageCreator(); return; }
      this.messageDraft.value = this.message.value;
      if (!this.messageDraft.value) this.suggestMessage();
      this.updateDraftCount();
      this.messageCreator.hidden = false;
      this.querySelector('[data-message-helper]').setAttribute('aria-expanded', 'true');
      this.messageCreator.querySelector('[data-message-creator-close]')?.focus();
    }
    if (event.target.closest('[data-message-creator-close]')) this.closeMessageCreator();
    const occasion = event.target.closest('button[data-message-occasion]');
    if (occasion) {
      this.messageOccasion = occasion.dataset.messageOccasion;
      this.querySelectorAll('button[data-message-occasion]').forEach((button) => button.setAttribute('aria-pressed', String(button === occasion)));
      this.suggestMessage();
    }
    if (event.target.closest('[data-message-suggest]')) this.suggestMessage();
    if (event.target.closest('[data-message-use]') && this.message && this.messageDraft) {
      this.message.value = this.messageDraft.value.slice(0, this.message.maxLength);
      this.message.dispatchEvent(new Event('input', { bubbles: true }));
      this.closeMessageCreator();
      this.message.focus();
    }
  }
  closeMessageCreator() {
    if (this.messageCreator) this.messageCreator.hidden = true;
    const helper = this.querySelector('[data-message-helper]');
    helper?.setAttribute('aria-expanded', 'false');
    helper?.focus();
  }
  suggestMessage() {
    if (!this.messageDraft) return;
    const messages = {
      birthday: ['Happy birthday! Wishing you a day full of love, laughter and joy.', 'Wishing you a wonderful birthday and a year filled with beautiful moments.', 'Here is to you! May your birthday be as lovely and special as you are.'],
      love: ['Just a little reminder of how much I love you. You make every day brighter.', 'You are my favourite person. Sending all my love, today and always.', 'Life is sweeter with you in it. I love you more than words can say.'],
      congratulations: ['Congratulations! So happy for you and everything you have achieved.', 'You did it! Wishing you every happiness as you begin this exciting chapter.', 'Celebrating you and this wonderful milestone. Congratulations!'],
      thanks: ['Thank you for everything. Your kindness means so much to me.', 'A little something to say a big thank you. You are truly appreciated.', 'Your thoughtfulness made all the difference. Thank you from the bottom of my heart.'],
      baby: ['A new baby brings new joys! Wishing your family all the best during this wonderful time.', 'Welcome to the world, little one! Sending love to your growing family.', 'Congratulations on your beautiful new arrival. Wishing you endless cuddles and happiness.'],
      sorry: ['I am sorry. Sending these flowers with love and the hope of making things a little brighter.', 'Please accept these flowers and my heartfelt apology. You mean so much to me.', 'I wish I could find the perfect words. For now, please know how sorry I am.'],
      mothers: ['Happy Mother’s Day! Thank you for your endless love, care and kindness.', 'For everything you do and all the love you give, thank you. Happy Mother’s Day!', 'Sending love to a wonderful mum. May your day be full of the happiness you bring to others.']
    };
    const occasion = this.messageOccasion || 'birthday';
    const suggestions = messages[occasion] || messages.birthday;
    this.messageSuggestionIndexes ||= {};
    const index = this.messageSuggestionIndexes[occasion] || 0;
    this.messageDraft.value = suggestions[index % suggestions.length].slice(0, this.messageDraft.maxLength);
    this.messageSuggestionIndexes[occasion] = index + 1;
    this.updateDraftCount();
  }
  updateDraftCount() {
    const count = this.querySelector('[data-message-draft-count]');
    if (count) count.textContent = this.messageDraft?.value.length || 0;
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

class DbProductRecommendations extends HTMLElement {
  showFallback() {
    if (!this.isConnected || !this.querySelector('[data-addon-variant]:not(:disabled)')) return;
    this.hidden = false;
    this.loaded = true;
    updateProductStepNumbers(this.closest('form'));
  }

  connectedCallback() {
    if (this.loading || this.loaded || !this.dataset.url) return;
    this.loading = true;
    fetch(this.dataset.url)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load recommendations');
        return response.text();
      })
      .then((html) => {
        if (!this.isConnected) return;
        const document = new DOMParser().parseFromString(html, 'text/html');
        const recommendations = document.querySelector('db-product-recommendations');
        if (!recommendations?.querySelector('[data-addon-variant], .db-product-card')) {
          this.showFallback();
          return;
        }
        this.innerHTML = recommendations.innerHTML;
        this.hidden = false;
        this.loaded = true;
        updateProductStepNumbers(this.closest('form'));
      })
      .catch(() => { this.showFallback(); })
      .finally(() => { this.loading = false; });
  }
}
if (!customElements.get('db-product-recommendations')) customElements.define('db-product-recommendations', DbProductRecommendations);
document.querySelectorAll('[data-product-builder-form]').forEach(updateProductStepNumbers);
document.addEventListener('shopify:section:load', (event) => event.target.querySelectorAll('[data-product-builder-form]').forEach(updateProductStepNumbers));
