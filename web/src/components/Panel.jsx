import React from 'react';

/**
 * Reusable panel wrapper.
 * `holoTop` adds the animated 1px holo gradient line on the top edge.
 */
export default function Panel({ children, holoTop = false, className = '', ...rest }) {
  return (
    <div
      className={`pw-panel ${holoTop ? 'pw-panel--holo-top' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHead({ title, count, right }) {
  return (
    <div
      className="flex items-center justify-between px-[22px] py-[18px]"
      style={{ borderBottom: 'var(--border-subtle)' }}
    >
      <span
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          color: 'var(--ink-secondary)',
        }}
      >
        {title}
      </span>
      <div className="flex items-center gap-3">
        {right}
        {count != null && (
          <span
            style={{
              fontFamily: 'var(--font-crt)',
              fontSize: 22,
              color: 'var(--accent-cyan)',
              letterSpacing: '0.05em',
            }}
          >
            {String(count).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  );
}
