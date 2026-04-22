// Polite HTTP wrapper around native fetch.
// Why: retailers rate-limit aggressively on cron traffic. Jittering the start
// and backing off on 429/5xx keeps us out of their ban list and survives
// transient blips without losing a whole 5-minute run.

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with randomised delay + exponential backoff on transient failures.
 *
 * @param {string}       url
 * @param {RequestInit=} opts
 * @param {number=}      retries  Retries after the initial attempt. Default 2 → 3 total tries.
 * @returns {Promise<Response>}   The final Response (may still be non-OK for non-retried statuses).
 */
export async function politeFetch(url, opts = {}, retries = 2) {
  // Up-front jitter so a watchlist of N items doesn't hammer the same host
  // at the same millisecond when Promise.allSettled fans them out.
  await sleep(Math.random() * 1500);

  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-CA,en;q=0.9',
    ...(opts.headers || {}),
  };

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      const res = await fetch(url, { ...opts, headers });

      // Retry only on rate-limit + server errors. Client errors (4xx) are usually
      // our fault (bad SKU, malformed URL) and won't change on retry.
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const backoff = 2 ** attempt * 1000 + Math.random() * 500;
          await sleep(backoff);
          attempt++;
          continue;
        }
      }

      return res;
    } catch (err) {
      // Network-level failure (DNS, reset, timeout). Same backoff policy.
      lastError = err;
      if (attempt < retries) {
        const backoff = 2 ** attempt * 1000 + Math.random() * 500;
        await sleep(backoff);
        attempt++;
        continue;
      }
      throw err;
    }
  }

  if (lastError) throw lastError;
  // Unreachable unless `retries` was negative.
  throw new Error(`politeFetch exhausted retries without a response: ${url}`);
}
