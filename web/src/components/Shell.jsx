import React from 'react';
import BrandMark from './BrandMark.jsx';
import { formatRunDelta } from '../lib/format.js';
import { clearAuth } from '../lib/auth.js';
import { useNavigate } from 'react-router-dom';

/**
 * Shell — wraps every authenticated route. Renders the header (brand mark +
 * status rail) and the main container. Mobile-first: status rail collapses
 * below the brand mark and shrinks at narrow widths.
 */
export default function Shell({ children, lastCommittedAt, watcherStatus = 'online' }) {
  const navigate = useNavigate();

  function onSignOut() {
    clearAuth();
    navigate('/');
  }

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 28px) 80px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 20,
          marginBottom: 28,
          borderBottom: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <BrandMark />
          <span
            className="pw-brand-sub"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 'clamp(14px, 2.5vw, 20px)',
              color: 'var(--ink-secondary)',
              letterSpacing: '0.01em',
            }}
          >
            — sealed product radar
          </span>
        </div>
        <StatusRail lastCommittedAt={lastCommittedAt} watcherStatus={watcherStatus} onSignOut={onSignOut} />
      </header>

      {children}
    </div>
  );
}

function StatusRail({ lastCommittedAt, watcherStatus, onSignOut }) {
  return (
    <div
      className="pw-status-rail"
      style={{
        display: 'flex',
        gap: 22,
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--ink-tertiary)',
        flexWrap: 'wrap',
      }}
    >
      <span className="inline-flex items-center gap-2">
        <span className={`pw-pulse-dot ${watcherStatus === 'online' ? '' : 'pw-pulse-dot--amber'}`} />
        watcher {watcherStatus}
      </span>
      <span>{formatRunDelta(lastCommittedAt)}</span>
      <button
        type="button"
        onClick={onSignOut}
        title="Forget PAT and sign out"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--ink-tertiary)',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          cursor: 'pointer',
          padding: 0,
        }}
        className="hover:text-[color:var(--accent-magenta)]"
      >
        sign out
      </button>
    </div>
  );
}
