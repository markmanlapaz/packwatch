import React from 'react';
import { formatRelative } from '../lib/format.js';

/**
 * Badge variants per CLAUDE.md:
 * - paused      → grey  ("paused")
 * - in stock    → mint  ("● in stock — Xm ago")
 * - out of stock → magenta ("out of stock")
 * - unknown      → amber  ("not yet checked")
 */
export default function StockBadge({ enabled, state }) {
  if (enabled === false) {
    return <Badge variant="paused">paused</Badge>;
  }
  if (!state) {
    return <Badge variant="unknown">not yet checked</Badge>;
  }
  if (state.inStock) {
    const rel = formatRelative(state.checkedAt);
    return (
      <Badge variant="live">
        <span className="pw-pulse-dot" style={{ width: 6, height: 6 }} aria-hidden="true" />
        in stock{rel ? ` — ${rel}` : ''}
      </Badge>
    );
  }
  return <Badge variant="oos">out of stock</Badge>;
}

const STYLE = {
  live:    { bg: 'rgba(125, 255, 180, 0.12)', fg: 'var(--accent-mint)', border: 'rgba(125, 255, 180, 0.35)' },
  oos:     { bg: 'rgba(255, 62, 165, 0.08)',  fg: '#ff7cc1',           border: 'rgba(255, 62, 165, 0.25)' },
  paused:  { bg: 'rgba(90, 98, 134, 0.15)',   fg: 'var(--ink-tertiary)', border: 'rgba(90, 98, 134, 0.3)' },
  unknown: { bg: 'rgba(255, 179, 71, 0.08)',  fg: 'var(--accent-amber)', border: 'rgba(255, 179, 71, 0.3)' },
};

function Badge({ variant, children }) {
  const s = STYLE[variant] || STYLE.unknown;
  return (
    <span
      className="inline-flex items-center gap-1.5 uppercase"
      style={{
        padding: '4px 10px',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}
