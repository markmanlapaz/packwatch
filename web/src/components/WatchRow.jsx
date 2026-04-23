import React from 'react';
import FoilBar from './FoilBar.jsx';
import StockBadge from './StockBadge.jsx';
import { formatPrice } from '../lib/format.js';

const RETAILER_LABEL = {
  bestbuy_ca: 'bestbuy.ca',
};

export default function WatchRow({ watch, state, flash, onEdit, onTogglePause }) {
  const enabled = watch.enabled !== false;
  const dim = !enabled;

  return (
    <div
      className={`pw-watch-row group ${flash ? 'pw-flash-restock' : ''}`}
      style={{
        padding: '18px 22px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 16,
        alignItems: 'center',
        borderBottom: '1px solid rgba(138, 92, 255, 0.08)',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-panel-hi)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
    >
      <FoilBar dim={dim} />

      <div className="min-w-0">
        <div
          className="pw-watch-name"
          title={watch.name}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            lineHeight: 1.2,
            letterSpacing: '-0.005em',
            color: dim ? 'var(--ink-secondary)' : 'var(--ink-primary)',
          }}
        >
          {watch.name}
        </div>

        <div
          className="pw-meta-row uppercase"
          style={{
            marginTop: 4,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-tertiary)',
            letterSpacing: '0.05em',
          }}
        >
          <span>{RETAILER_LABEL[watch.retailer] ?? watch.retailer}</span>
          <Divider />
          <span>sku {watch.sku}</span>
          <Divider />
          <span>{watch.maxPrice != null ? `≤ ${formatPrice(watch.maxPrice)}` : 'any price'}</span>
          <Divider />
          <StockBadge enabled={enabled} state={state} />
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          className="pw-icon-btn"
          aria-label={`Edit ${watch.name}`}
          title="Edit"
          onClick={() => onEdit?.(watch)}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="pw-icon-btn"
          aria-label={enabled ? `Pause ${watch.name}` : `Resume ${watch.name}`}
          title={enabled ? 'Pause' : 'Resume'}
          onClick={() => onTogglePause?.(watch)}
        >
          {enabled ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" style={{ color: 'var(--ink-dim)' }}>/</span>;
}

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.5 2.5 13.5 4.5 5 13H3v-2l8.5-8.5z" />
      <path d="m10 4 2 2" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="3" width="2.5" height="10" rx="0.5" />
      <rect x="9.5" y="3" width="2.5" height="10" rx="0.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 3 12.5 8l-8 5z" />
    </svg>
  );
}
