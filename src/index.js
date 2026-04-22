// Watcher entry point. Invoked by `npm start` locally and by GitHub Actions
// in CI. Follows the CLAUDE.md core loop: load config + state → check in
// parallel → diff → notify on OOS→in-stock transitions → persist.
//
// Design non-negotiables (per CLAUDE.md):
// - Silent by default: only notify on the transition, never on "still in-stock".
// - Fail loud in logs, fail quiet in notifications: parse failures throw, which
//   gets logged but preserves the prior state entry — no spurious ping.
// - Idempotent: successive runs with the same API responses produce no new
//   notifications.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { adapters } from './adapters/index.js';
import { loadState, saveState } from './state.js';
import { logger } from './lib/logger.js';
import { sendDiscord } from './notify/discord.js';
import { sendEmail } from './notify/email.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WATCHLIST_PATH = resolve(HERE, '..', 'config', 'watchlist.json');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function loadWatchlist() {
  const raw = await readFile(WATCHLIST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.watches)) {
    throw new Error('config/watchlist.json: missing "watches" array');
  }
  return parsed.watches;
}

/**
 * Run a single watch through its adapter. Never throws — wraps failures in
 * a tagged result so Promise.allSettled-style orchestration isn't needed.
 */
async function runOne(watch) {
  const adapter = adapters[watch.retailer];
  if (!adapter) {
    return { watch, ok: false, error: new Error(`no adapter for retailer "${watch.retailer}"`) };
  }
  try {
    const result = await adapter.check(watch);
    return { watch, ok: true, result };
  } catch (error) {
    return { watch, ok: false, error };
  }
}

/**
 * Did we cross the OOS → in-stock boundary for this watch?
 * Treats "no prior entry" as OOS so first-ever in-stock reads DO notify.
 * Gated on maxPrice if the watch declared one.
 */
function shouldNotify(watch, previous, current) {
  if (!current.inStock) return false;
  const wasInStock = previous?.inStock === true;
  if (wasInStock) return false;
  if (typeof watch.maxPrice === 'number' && typeof current.price === 'number') {
    if (current.price > watch.maxPrice) return false;
  }
  return true;
}

async function notifyAll(result) {
  // Run both channels regardless of individual failure — Discord down should
  // not suppress the email, and vice versa. CLAUDE.md calls this out explicitly.
  const outcomes = await Promise.allSettled([sendDiscord(result), sendEmail(result)]);
  outcomes.forEach((o, i) => {
    if (o.status === 'rejected') {
      const channel = i === 0 ? 'discord' : 'email';
      logger.error(`${channel} notify failed for ${result.watchId}:`, o.reason);
    }
  });
}

async function main() {
  const startedAt = Date.now();
  logger.info(`run starting (dryRun=${DRY_RUN})`);

  const [watches, previousState] = await Promise.all([loadWatchlist(), loadState()]);
  const enabled = watches.filter((w) => w.enabled !== false);
  logger.info(`watches: ${enabled.length} enabled of ${watches.length} total`);

  // Parallel adapter checks with per-watch error isolation.
  const outcomes = await Promise.allSettled(enabled.map(runOne));

  // Start from the prior state so disabled watches + failed checks preserve
  // their last-known stock state. We only overwrite entries we successfully
  // re-checked this run.
  const nextState = { ...previousState };
  const notifications = [];

  for (const o of outcomes) {
    // runOne never throws, but allSettled still guards us against bugs.
    if (o.status !== 'fulfilled') {
      logger.error('unexpected runOne rejection:', o.reason);
      continue;
    }
    const { watch, ok, result, error } = o.value;
    if (!ok) {
      logger.warn(`check failed — ${watch.retailer}/${watch.id}: ${error.message}`);
      continue;
    }

    const previous = previousState[watch.id];
    if (shouldNotify(watch, previous, result)) {
      notifications.push(result);
    }
    nextState[watch.id] = result;

    logger.debug(
      `${watch.id}: inStock=${result.inStock} price=${result.price ?? 'n/a'} conf=${result.confidence}`
    );
  }

  if (notifications.length === 0) {
    logger.info('no restock transitions this run');
  } else {
    logger.info(`${notifications.length} restock transition(s) — sending notifications`);
    if (DRY_RUN) {
      for (const r of notifications) {
        logger.info(`[DRY_RUN] would notify: ${r.name} @ ${r.url}`);
      }
    } else {
      // Sequential so a wall of simultaneous restocks doesn't fan out into
      // a burst of API calls that trips Resend / Discord rate limits.
      for (const r of notifications) {
        await notifyAll(r);
      }
    }
  }

  if (DRY_RUN) {
    logger.info('[DRY_RUN] state write skipped');
  } else {
    await saveState(nextState);
  }

  logger.info(`run complete in ${Date.now() - startedAt}ms`);
}

main().catch((err) => {
  // Top-level failure (bad config, fs errors, etc). Exit non-zero so the
  // Actions run shows red and we notice.
  logger.error('fatal:', err);
  process.exitCode = 1;
});
