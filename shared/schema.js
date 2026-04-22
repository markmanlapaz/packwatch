// Canonical data shapes + retailer registry.
// Imported by BOTH the watcher (src/) and the web UI (web/).
// Must stay dependency-free so it runs in Node and the browser without a bundler step.

/**
 * A single watch entry. Lives in config/watchlist.json.
 *
 * @typedef {Object} Watch
 * @property {string}  id        Stable slug. Used as the state-diffing key.
 *                               Changing it resets stock history for that watch.
 * @property {string}  name      Human-readable product name shown in notifications.
 * @property {string}  retailer  Key into RETAILERS below (e.g. "bestbuy_ca").
 * @property {string}  sku       Retailer-specific product ID. Required for bestbuy_ca.
 * @property {number=} maxPrice  Don't notify if price is above this. Optional; if
 *                               absent, price gate is skipped.
 * @property {boolean=} enabled  Defaults to true. Set false to pause without deleting.
 */
export const WATCH_SHAPE = /** @type {Watch} */ ({});

/**
 * The normalised result every adapter must return from its check() method.
 * If an adapter can't produce this with confidence, it MUST throw instead —
 * a false positive is worse than a miss.
 *
 * @typedef {Object} WatchResult
 * @property {string}              watchId    Matches Watch.id.
 * @property {string}              name       Echoes Watch.name for downstream use.
 * @property {string}              retailer   Echoes Watch.retailer.
 * @property {boolean}             inStock    True iff the item is purchasable now.
 * @property {number|null}         price      Current price in CAD, or null if unknown.
 * @property {string}              url        Direct product URL for the notification CTA.
 * @property {string}              checkedAt  ISO-8601 timestamp of the check.
 * @property {'high'|'low'}        confidence 'low' prefixes notifications with ⚠️.
 */
export const WATCHRESULT_SHAPE = /** @type {WatchResult} */ ({});

// Retailer registry. Add an entry here when a new adapter lands so the UI can list it.
// Keys match the `retailer` field on a watch and the `name` export on each adapter.
export const RETAILERS = {
  bestbuy_ca: {
    label: 'Best Buy Canada',
    country: 'CA',
    // URL template used by the UI when reconstructing product links from a SKU.
    productUrl: (sku) => `https://www.bestbuy.ca/en-ca/product/${sku}`,
  },
};
