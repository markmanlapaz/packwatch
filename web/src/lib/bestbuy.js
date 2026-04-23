/**
 * Best Buy CA product fetch — used by the Add/Edit form to auto-fill the preview.
 * Hits the same public JSON endpoints the watcher uses.
 *
 * If CORS breaks in the future, fall back to manual entry (caller handles).
 */

const SKU_RE = /\/(\d{6,})(?:[/?#]|$)/;

/** Extract a Best Buy CA SKU from a pasted product URL or a raw SKU string. */
export function extractSku(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!/bestbuy\.ca$/.test(url.hostname)) {
      const match = trimmed.match(SKU_RE);
      return match ? match[1] : null;
    }
    const match = url.pathname.match(SKU_RE);
    return match ? match[1] : null;
  } catch {
    const match = trimmed.match(SKU_RE);
    return match ? match[1] : null;
  }
}

/** Build a canonical product URL from a SKU. */
export function productUrl(sku) {
  return `https://www.bestbuy.ca/en-ca/product/${sku}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Fetch product details for a SKU. Returns the normalized shape, or { error, sku }
 * if the lookup fails (CORS, 404, network, etc.) so the caller can ask the user
 * to type the name manually rather than failing the whole flow.
 *
 * @returns {Promise<{ sku: string, name: string, price: number|null, url: string } | { error: string, sku: string|null }>}
 */
export async function fetchProduct(input) {
  const sku = extractSku(input);
  if (!sku) {
    return { error: 'Could not find a SKU in that URL.', sku: null };
  }

  try {
    const detailsUrl = `https://www.bestbuy.ca/ecomm-api/products/${sku}?lang=en-CA`;
    const availUrl = `https://www.bestbuy.ca/ecomm-api/availability/products?skus=${sku}`;

    const [details, avail] = await Promise.all([
      fetchJson(detailsUrl),
      fetchJson(availUrl).catch(() => null),
    ]);

    const name = details?.name || details?.productName || `SKU ${sku}`;
    let price = null;
    if (typeof details?.salePrice === 'number') price = details.salePrice;
    else if (typeof details?.regularPrice === 'number') price = details.regularPrice;
    else if (typeof details?.price === 'number') price = details.price;

    if (price == null && avail?.availabilities?.[0]?.shipping?.price != null) {
      price = avail.availabilities[0].shipping.price;
    }

    return { sku, name, price, url: productUrl(sku) };
  } catch (err) {
    return {
      error: err?.status
        ? `Best Buy returned ${err.status}.`
        : 'Could not reach Best Buy (CORS or network). Enter the name manually.',
      sku,
    };
  }
}
