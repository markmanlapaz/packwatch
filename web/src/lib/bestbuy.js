/**
 * Best Buy CA product fetch — used by the Add/Edit form to auto-fill the preview.
 *
 * Strategy:
 *   - SKU is extracted from the pasted URL (no network).
 *   - Name is extracted from the URL slug (no network) — Best Buy URLs encode
 *     the human title as a slug between /product/ and /<sku>.
 *   - Price is fetched from the public availability endpoint, the same one
 *     the watcher uses. If CORS blocks it (or it just hangs), we time out
 *     after 8s and let the user enter the price manually.
 *
 * Never hangs. Always returns within ~8s.
 */

const SKU_RE = /\/(\d{6,})(?:[/?#]|$)/;
const SLUG_RE = /\/product\/([^/]+)\/\d{6,}/i;
const AVAIL_API = 'https://www.bestbuy.ca/ecomm-api/availability/products';
const FETCH_TIMEOUT_MS = 8000;

/** Extract a Best Buy CA SKU from a pasted product URL or a raw SKU string. */
export function extractSku(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(SKU_RE);
    if (match) return match[1];
  } catch { /* fall through */ }
  const match = trimmed.match(SKU_RE);
  return match ? match[1] : null;
}

/** Pull a human-ish title out of the URL slug. Best-effort, can be empty. */
export function extractNameFromUrl(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  let path = trimmed;
  try { path = new URL(trimmed).pathname; } catch { /* not a URL — try as path */ }
  const match = path.match(SLUG_RE);
  if (!match) return '';
  return match[1]
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Build a canonical product URL from a SKU. */
export function productUrl(sku) {
  return `https://www.bestbuy.ca/en-ca/product/${sku}`;
}

async function fetchAvailabilityWithTimeout(sku) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${AVAIL_API}?skus=${encodeURIComponent(sku)}&lang=en-CA`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch product details for a SKU. Always returns within ~8s.
 * Never throws — failures come back as { warning } so the caller can keep going.
 *
 * @returns {Promise<{
 *   sku: string,
 *   name: string,
 *   price: number|null,
 *   url: string,
 *   warning?: string
 * } | { error: string, sku: string|null }>}
 */
export async function fetchProduct(input) {
  const sku = extractSku(input);
  if (!sku) {
    return { error: 'Could not find a SKU in that URL.', sku: null };
  }

  const name = extractNameFromUrl(input);
  const url = productUrl(sku);

  let price = null;
  let warning;
  try {
    const data = await fetchAvailabilityWithTimeout(sku);
    const entry = data?.availabilities?.[0];
    if (entry) {
      const raw = entry?.salePrice ?? entry?.regularPrice ?? entry?.price ?? null;
      if (typeof raw === 'number') price = raw;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      warning = 'Price lookup timed out — enter the price manually.';
    } else if (err.status) {
      warning = `Best Buy returned ${err.status} — enter the price manually.`;
    } else {
      warning = 'Browser blocked the price lookup (CORS) — enter the price manually.';
    }
  }

  return { sku, name, price, url, warning };
}
