// Persistence for the previous-run stock snapshot.
// Why a plain JSON file: this tool runs in GitHub Actions, which has no
// persistent storage — but it does have the repo itself. Writing state.json
// and letting the workflow commit it back gives us durable, version-controlled
// state with zero infrastructure.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// state.json lives at repo root — one level up from src/.
const STATE_PATH = resolve(HERE, '..', 'state.json');

/**
 * Load the previous run's state. Missing/invalid file → empty object so
 * first-ever runs never crash and also never emit spurious "OOS → in-stock"
 * pings (every watch starts with no prior record).
 *
 * @returns {Promise<Record<string, import('../shared/schema.js').WatchResult>>}
 */
export async function loadState() {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    // Guard against someone hand-editing the file into an array or null.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Persist the new state snapshot. Pretty-printed so the commit diff is
 * human-readable.
 *
 * @param {Record<string, import('../shared/schema.js').WatchResult>} state
 */
export async function saveState(state) {
  const json = JSON.stringify(state, null, 2) + '\n';
  await writeFile(STATE_PATH, json, 'utf8');
}
