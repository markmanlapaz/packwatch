import { useCallback, useEffect, useRef, useState } from 'react';
import { readWatchlist, readState, writeWatchlist } from '../lib/github.js';

const STATE_POLL_MS = 30_000;

/**
 * Top-level data hook for the watchlist + last-known stock state.
 * - Loads watchlist + state in parallel.
 * - Polls state every 30s while the tab is visible.
 * - Tracks per-watch in-stock transitions so the UI can flash a row.
 */
export function useWatchlist() {
  const [watches, setWatches] = useState([]);
  const [sha, setSha] = useState(null);
  const [state, setState] = useState({});
  const [lastCommittedAt, setLastCommittedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restocked, setRestocked] = useState({});

  const prevStockRef = useRef({});
  const restockTimersRef = useRef({});

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [wl, st] = await Promise.all([readWatchlist(), readState()]);
      setWatches(wl.watches);
      setSha(wl.sha);
      setState(st.state || {});
      setLastCommittedAt(st.lastCommittedAt);

      const next = st.state || {};
      const prev = prevStockRef.current;
      const flashes = {};
      for (const id of Object.keys(next)) {
        const wasIn = prev[id]?.inStock === true;
        const nowIn = next[id]?.inStock === true;
        if (!wasIn && nowIn && Object.keys(prev).length > 0) {
          flashes[id] = Date.now();
        }
      }
      if (Object.keys(flashes).length) {
        setRestocked((r) => ({ ...r, ...flashes }));
        for (const id of Object.keys(flashes)) {
          clearTimeout(restockTimersRef.current[id]);
          restockTimersRef.current[id] = setTimeout(() => {
            setRestocked((r) => {
              const { [id]: _, ...rest } = r;
              return rest;
            });
          }, 2000);
        }
      }
      prevStockRef.current = next;
    } catch (err) {
      setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + polling (paused when tab is hidden)
  useEffect(() => {
    refresh();
    let interval = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => refresh({ silent: true }), STATE_POLL_MS);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    start();
    const onVis = () => {
      if (document.visibilityState === 'visible') { refresh({ silent: true }); start(); }
      else stop();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      Object.values(restockTimersRef.current).forEach(clearTimeout);
    };
  }, [refresh]);

  const addWatch = useCallback(async (watch) => {
    const next = [...watches, watch];
    const result = await writeWatchlist(next, sha, `web: add ${watch.id}`);
    setWatches(next);
    setSha(result.sha);
  }, [watches, sha]);

  const updateWatch = useCallback(async (id, patch) => {
    const next = watches.map((w) => (w.id === id ? { ...w, ...patch } : w));
    const result = await writeWatchlist(next, sha, `web: update ${id}`);
    setWatches(next);
    setSha(result.sha);
  }, [watches, sha]);

  const deleteWatch = useCallback(async (id) => {
    const next = watches.filter((w) => w.id !== id);
    const result = await writeWatchlist(next, sha, `web: remove ${id}`);
    setWatches(next);
    setSha(result.sha);
  }, [watches, sha]);

  return {
    watches,
    state,
    sha,
    lastCommittedAt,
    loading,
    error,
    restocked,
    refresh,
    addWatch,
    updateWatch,
    deleteWatch,
  };
}
