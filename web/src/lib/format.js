/** Misc formatters. */

export function formatPrice(price) {
  if (price == null || isNaN(price)) return '—';
  return `$${Number(price).toFixed(2)}`;
}

export function formatRelative(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Convert "14 minutes" → "14m" for the status rail. */
export function formatRunDelta(iso) {
  const rel = formatRelative(iso);
  return rel ? `last run ${rel}` : 'last run unknown';
}
