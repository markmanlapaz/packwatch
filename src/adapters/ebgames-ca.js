// EB Games Canada adapter.
//
// Data path: the product page ships JSON-LD in a <script type="application/ld+json">
// block. The relevant block has:
//   { "@type": "Product", "offers": { "availability": "...InStock|OutOfStock",
//                                     "price": "79.99", ... }, ... }
// Some pages include multiple ld+json blocks (BreadcrumbList, ItemList, etc.) —
// we iterate them all and pick the Product block. Some blocks use `@graph` to
// bundle entities; we flatten that too.
//
// There's no public JSON API. JSON-LD is the intended, SEO-critical data path,
// so while it's HTML scraping in a technical sense, it's far more stable than
// parsing rendered markup.
//
// Parsing: a regex for <script type="application/ld+json">(.*?)</script>
// (non-greedy, dotall) is sufficient here and keeps the watcher dep-light. The
// script body is already JSON — no HTML entity decoding needed inside the
// payload proper (EB Games serves it clean; verified against the live page).
// If this ever flakes, swap to cheerio — but don't pre-emptively add it.

import { politeFetch } from '../lib/fetch.js';

// Small pool of recent desktop Chrome UAs. Rotation is a modest politeness
// gesture — not evasion. EB Games does lightweight UA sniffing; a realistic
// one keeps us out of their "bot" bucket.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];

const LD_JSON_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extract the first JSON-LD block that represents a Product.
 * Handles both top-level Product entries and `@graph` arrays.
 */
function findProductLd(html) {
  LD_JSON_RE.lastIndex = 0;
  let match;
  while ((match = LD_JSON_RE.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed block — skip, try the next
    }
    const candidates = [];
    if (Array.isArray(parsed)) candidates.push(...parsed);
    else if (parsed && Array.isArray(parsed['@graph'])) candidates.push(...parsed['@graph']);
    else candidates.push(parsed);

    for (const node of candidates) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
        return node;
      }
    }
  }
  return null;
}

/**
 * Map a schema.org availability URL to a boolean. Throws on anything we don't
 * recognise — PreOrder, Discontinued, etc. aren't "in stock" and we'd rather
 * log a loud error than silently misclassify.
 */
function availabilityToInStock(availability) {
  if (typeof availability !== 'string') {
    throw new Error(`ebgames_ca: availability is not a string (${typeof availability})`);
  }
  const normalized = availability.trim();
  if (/\/InStock$/i.test(normalized)) return true;
  if (/\/OutOfStock$/i.test(normalized)) return false;
  throw new Error(`ebgames_ca: unexpected availability "${normalized}"`);
}

function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

async function check(watch) {
  if (!watch.url) {
    throw new Error(`ebgames_ca: watch "${watch.id}" has no url`);
  }

  const res = await politeFetch(watch.url, {
    headers: {
      'User-Agent': pickUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-CA,en;q=0.9',
      Referer: 'https://www.ebgames.ca/',
    },
  });

  if (!res.ok) {
    throw new Error(`ebgames_ca HTTP ${res.status} for ${watch.url}`);
  }

  const html = await res.text();
  const product = findProductLd(html);
  if (!product) {
    throw new Error(`ebgames_ca: no Product JSON-LD block found for ${watch.url}`);
  }

  // `offers` can be a single object or an array. We take the first.
  const offersRaw = product.offers;
  const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
  if (!offer || typeof offer !== 'object') {
    throw new Error(`ebgames_ca: Product JSON-LD missing offers for ${watch.url}`);
  }

  const inStock = availabilityToInStock(offer.availability);
  const price = parsePrice(offer.price);

  return {
    watchId: watch.id,
    name: watch.name,
    retailer: 'ebgames_ca',
    inStock,
    price,
    url: watch.url,
    checkedAt: new Date().toISOString(),
    // Availability parsed cleanly = high confidence. Missing price on an
    // otherwise-valid Product block downgrades to 'low' so the notifier
    // prefixes with ⚠️ (matches bestbuy_ca's policy).
    confidence: price == null ? 'low' : 'high',
  };
}

export default {
  name: 'ebgames_ca',
  check,
  // Exported for tests — not part of the adapter contract.
  _internals: { findProductLd, availabilityToInStock, parsePrice },
};
