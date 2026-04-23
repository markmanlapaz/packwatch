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
          className="truncate"
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
          ✎
        </button>
        <button
          type="button"
          className="pw-icon-btn"
          aria-label={enabled ? `Pause ${watch.name}` : `Resume ${watch.name}`}
          title={enabled ? 'Pause' : 'Resume'}
          onClick={() => onTogglePause?.(watch)}
        >
          {enabled ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" style={{ color: 'var(--ink-dim)' }}>/</span>;
}
