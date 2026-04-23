import React from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import Panel, { PanelHead } from '../components/Panel.jsx';
import WatchRow from '../components/WatchRow.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';
import { useToast } from '../components/Toast.jsx';
import { GhConflictError } from '../lib/github.js';

export default function Watchlist() {
  const navigate = useNavigate();
  const toast = useToast();
  const wl = useWatchlist();

  async function onTogglePause(w) {
    try {
      await wl.updateWatch(w.id, { enabled: w.enabled === false });
      toast.push({ kind: 'success', message: `${w.enabled === false ? 'Resumed' : 'Paused'} ${w.name}` });
    } catch (err) {
      handleWriteError(err, toast, wl.refresh);
    }
  }

  return (
    <Shell lastCommittedAt={wl.lastCommittedAt}>
      {/* Hero */}
      <h1 className="pw-hero" style={heroStyle}>
        {wl.loading ? (
          <span style={{ color: 'var(--ink-tertiary)' }}>Loading watchlist…</span>
        ) : wl.error ? (
          <>
            Watchlist unreachable. <em style={emStyle}>Check your PAT.</em>
          </>
        ) : wl.watches.length === 0 ? (
          <>
            No watches yet. <em style={emStyle}>Add your first SKU</em> to start the radar.
          </>
        ) : (
          <>
            {wl.watches.length === 1 ? '1 SKU' : `${wl.watches.length} SKUs`} in rotation.{' '}
            <em style={emStyle}>{summarize(wl.state)}</em> Silent until something moves.
          </>
        )}
      </h1>
      <div style={metaStyle}>
        config · watchlist.json · {wl.lastCommittedAt ? new Date(wl.lastCommittedAt).toISOString().split('T')[0] : '—'}
      </div>

      {wl.error && (
        <div role="alert" style={errorPanelStyle}>
          <strong>{wl.error.name || 'Error'}:</strong> {wl.error.message}
        </div>
      )}

      <div className="pw-grid" style={gridStyle}>
        <Panel>
          <PanelHead title="Active watchlist" count={wl.watches.length} />
          {wl.watches.length === 0 && !wl.loading && !wl.error ? (
            <EmptyState onAdd={() => navigate('/add')} />
          ) : (
            wl.watches.map((w) => (
              <WatchRow
                key={w.id}
                watch={w}
                state={wl.state[w.id]}
                flash={!!wl.restocked[w.id]}
                onEdit={(watch) => navigate(`/edit/${encodeURIComponent(watch.id)}`)}
                onTogglePause={onTogglePause}
              />
            ))
          )}
        </Panel>

        <Panel holoTop className="pw-sticky-aside" style={{ padding: 24, alignSelf: 'start' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            Add a watch
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 22 }}>
            Paste a Best Buy Canada product URL. We'll pull the SKU, title, and current
            price automatically.
          </p>
          <button
            type="button"
            className="pw-btn-primary"
            onClick={() => navigate('/add')}
          >
            New watch →
          </button>
        </Panel>
      </div>
    </Shell>
  );
}

function summarize(state) {
  const live = Object.values(state).filter((s) => s?.inStock).length;
  if (live === 0) return 'All quiet right now.';
  if (live === 1) return 'One SKU live.';
  return `${live} SKUs live.`;
}

function EmptyState({ onAdd }) {
  return (
    <div style={{ padding: '40px 22px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--ink-secondary)',
          marginBottom: 14,
        }}
      >
        Nothing to watch yet.
      </div>
      <button type="button" className="pw-btn-ghost" onClick={onAdd}>
        Add the first SKU
      </button>
    </div>
  );
}

export function handleWriteError(err, toast, refresh) {
  if (err instanceof GhConflictError) {
    toast.push({
      kind: 'warn',
      message: 'Watchlist changed on GitHub. Reloading…',
      ttl: 3000,
    });
    refresh?.();
    return;
  }
  toast.push({ kind: 'error', message: err.message || 'Save failed.' });
}

/* styles */
const heroStyle = {
  margin: '20px 0 14px',
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(34px, 4.2vw, 44px)',
  lineHeight: 1.04,
  letterSpacing: '-0.02em',
  color: 'var(--ink-primary)',
  maxWidth: '58ch',
};
const emStyle = {
  fontStyle: 'italic',
  background: 'linear-gradient(100deg, var(--accent-cyan), var(--accent-magenta))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};
const metaStyle = {
  marginBottom: 28,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-tertiary)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
  gap: 24,
};
const errorPanelStyle = {
  marginBottom: 20,
  padding: '12px 16px',
  background: 'rgba(255, 62, 165, 0.08)',
  border: '1px solid rgba(255, 62, 165, 0.3)',
  borderRadius: 6,
  color: '#ff7cc1',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
};
