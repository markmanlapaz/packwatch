// Best Buy Canada adapter.
//
// Endpoint (public, undocumented, used by their own storefront):
//   GET https://www.bestbuy.ca/ecomm-api/availability/products?skus=<sku>&lang=en-CA
//
// Returns JSON shaped roughly as:
//   {
//     "availabilities": [{
//       "sku": "17890123",
//       "pickup":   { "purchasable": false, ... },
//       "shipping": { "purchasable": true,  ... },
//       "salePrice": 79.99,
//       "regularPrice": 89.99
//     }]
//   }
//
// "Purchasable via shipping" is our stock signal — we're watching for online
// restocks, not in-store-pickup availability.

import { politeFetch } from '../lib/fetch.js';

const API = 'https://www.bestbuy.ca/ecomm-api/availability/products';

const productUrl = (sku) => `https://www.bestbuy.ca/en-ca/product/${sku}`;

async function check(watch) {
  if (!watch.sku) {
    throw new Error(`bestbuy_ca: watch "${watch.id}" has no sku`);
  }

  const url = `${API}?skus=${encodeURIComponent(watch.sku)}&lang=en-CA`;
  const res = await politeFetch(url, {
    headers: {
      // The endpoint is quietly stricter with non-browser referers.
      Referer: productUrl(watch.sku),
      Origin: 'https://www.bestbuy.ca',
    },
  });

  if (!res.ok) {
    throw new Error(`bestbuy_ca HTTP ${res.status} for sku ${watch.sku}`);
  }

  const data = await res.json();
  const entry = data?.availabilities?.[0];
  if (!entry) {
    // Unknown SKU or shape change. Throw so the run logs it and preserves
    // prior state — never silently flip inStock to true.
    throw new Error(`bestbuy_ca: no availability entry for sku ${watch.sku}`);
  }

  const shippingPurchasable = entry?.shipping?.purchasable;
  if (typeof shippingPurchasable !== 'boolean') {
    throw new Error(`bestbuy_ca: missing shipping.purchasable for sku ${watch.sku}`);
  }

  // Price isn't always present on the availability endpoint. Try a couple of
  // well-known field names, fall back to null. Price-absent is fine; we only
  // gate on it if the watch declared a maxPrice.
  const priceRaw =
    entry?.salePrice ?? entry?.regularPrice ?? entry?.price ?? null;
  const price = typeof priceRaw === 'number' ? priceRaw : null;

  return {
    watchId: watch.id,
    name: watch.name,
    retailer: 'bestbuy_ca',
    inStock: shippingPurchasable,
    price,
    url: productUrl(watch.sku),
    checkedAt: new Date().toISOString(),
    // Confident when we got a clean boolean + numeric price. Otherwise "low"
    // so the notifier can prefix with ⚠️.
    confidence: shippingPurchasable && price == null ? 'low' : 'high',
  };
}

export default {
  name: 'bestbuy_ca',
  check,
};
