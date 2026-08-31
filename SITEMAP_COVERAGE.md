# Storefront sitemap and commerce coverage

Audit date: 2026-08-26

## Current Flowers Across Christchurch sitemap

- 41 products
- 22 collections
- 11 standard pages
- 18 blog and article URLs
- 23 `flower_delivery_page` metaobject suburb pages

All current resource types have matching theme templates. The 23 suburb pages use `templates/metaobject/flower_delivery_page.json` and render their existing metaobject title, subtitle, map, story and FAQ fields.

## Daily Blooms comparison

Daily Blooms currently indexes 196 products, 559 collections, 1,080 standard pages and 106 blog/article URLs. Most of its standard pages are location SEO pages for Australian suburbs and should not be copied into a Christchurch store.

Useful content families not currently represented by a dedicated Flowers Across Christchurch page are:

- Flower care guide
- Reviews and customer stories
- Events and corporate gifting
- Delivery-area overview
- Gift-card help and balance guidance
- Loyalty or flower rewards

These are Shopify content resources, not theme files. Create only the pages that match the merchant's actual services, then use the existing editorial page system or add a campaign template when richer imagery is required.

## Product builder

The product section supports:

- Variant selection
- Quantity
- Recipient suburb line-item property
- Preferred delivery date line-item property
- Optional vase add-on collection
- Optional extra-gift collection
- One-request bundle add to cart

Configure the vase and gift collections from the product section in the Theme Editor. When no gift collection is selected, the theme falls back to the `plants-others` collection when available.

## Cart gifting

The cart supports:

- Four-step progress indicator
- Recipient and sender names
- Gift message with character limit
- Delivery instructions
- Display of delivery properties captured on the product page
- Merchant-selected extra-gift collection
- Add-gift buttons that update the Shopify cart

Configure the extra-gift collection and visibility toggles from the cart section in the Theme Editor.
