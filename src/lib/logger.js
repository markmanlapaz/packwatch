// Leveled logger. Thin wrapper over console.* with LOG_LEVEL filtering.
// Why: CLAUDE.md mandates "fail loud in logs, fail quiet in notifications" —
// so we always write to stdout/stderr where GitHub Actions can capture it,
// never anywhere a user would see a stray error.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configured] ?? LEVELS.info;

const should = (lvl) => LEVELS[lvl] >= threshold;

// A tiny timestamp helps when scanning an Actions log after a missed restock.
const stamp = () => new Date().toISOString();

export const logger = {
  debug: (...args) => should('debug') && console.log(`[${stamp()}] [debug]`, ...args),
  info: (...args) => should('info') && console.log(`[${stamp()}] [info ]`, ...args),
  warn: (...args) => should('warn') && console.warn(`[${stamp()}] [warn ]`, ...args),
  error: (...args) => should('error') && console.error(`[${stamp()}] [error]`, ...args),
};
