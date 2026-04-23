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
 * @property {string=} sku       Retailer-specific product ID. Required for bestbuy_ca.
 * @property {string=} url       Full product URL. Required for ebgames_ca (their adapter
 *                               fetches the HTML page and scrapes JSON-LD; a bare SKU
 *                               isn't enough to reconstruct the product URL).
 * @property {number=} maxPrice  Don't notify if price is above this. Optional; if
 *                               absent, price gate is skipped.
 * @property {boolean=} enabled  Defaults to true. Set false to pause without deleting.
 *
 * Per-retailer required fields (what the UI and adapters rely on):
 *   bestbuy_ca → `sku`
 *   ebgames_ca → `url`
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
//
// Contract (per entry):
//   key               - matches the registry key (handy when iterating Object.values).
//   label             - display name for the UI retailer selector.
//   domain            - short form shown in watch rows (e.g. "bestbuy.ca").
//   country           - ISO country code (informational; used for country flag, if any).
//   supportsAutoFetch - true if the UI can auto-fill name + price from a pasted URL.
//                       false means the UI shows a manual-entry form.
//   urlPattern        - RegExp used by the UI to validate a pasted URL and confirm it
//                       belongs to this retailer. Capture group 1 = SKU.
//   skuFromUrl(url)   - returns the SKU as a string, or null if the URL is malformed
//                       for this retailer. Dependency-free; safe in Node and browsers.
//   productUrl(sku)   - reconstructs a canonical product URL from a SKU. Best-effort —
//                       ebgames_ca can't do this (SKU alone isn't enough), so it
//                       echoes the stored url instead at the call site.
//   watchField        - which Watch field the adapter reads as its product identifier
//                       ("sku" for bestbuy_ca, "url" for ebgames_ca). Lets the UI
//                       decide what to persist.
export const RETAILERS = {
  bestbuy_ca: {
    key: 'bestbuy_ca',
    label: 'Best Buy Canada',
    domain: 'bestbuy.ca',
    country: 'CA',
    supportsAutoFetch: true,
    watchField: 'sku',
    // Matches the trailing numeric SKU in a Best Buy CA product URL.
    // Example: https://www.bestbuy.ca/en-ca/product/.../17890123
    urlPattern: /bestbuy\.ca\/.+\/(\d{6,})(?:[/?#]|$)/,
    skuFromUrl: (input) => {
      if (!input) return null;
      const trimmed = String(input).trim();
      const m = trimmed.match(/\/(\d{6,})(?:[/?#]|$)/);
      return m ? m[1] : null;
    },
    productUrl: (sku) => `https://www.bestbuy.ca/en-ca/product/${sku}`,
  },
  ebgames_ca: {
    key: 'ebgames_ca',
    label: 'EB Games CA',
    domain: 'ebgames.ca',
    country: 'CA',
    // Auto-fetch deferred: JSON-LD is only on the server-rendered HTML, and the
    // browser can't fetch ebgames.ca cross-origin. A Cloudflare Worker proxy
    // (Phase 3) will flip this to true.
    supportsAutoFetch: false,
    watchField: 'url',
    // Example: https://www.ebgames.ca/pokemon-tcg/...-elite-trainer-box/872627.html
    urlPattern: /ebgames\.ca\/.+\/(\d+)\.html/,
    skuFromUrl: (input) => {
      if (!input) return null;
      const trimmed = String(input).trim();
      const m = trimmed.match(/ebgames\.ca\/.+\/(\d+)\.html(?:[?#]|$)/);
      return m ? m[1] : null;
    },
    productUrl: (_sku) => null, // URL is the source of truth for EB Games, not SKU.
  },
};
