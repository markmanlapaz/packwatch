import React, { useEffect } from 'react';

/** Lightweight modal — used for confirmations and destructive prompts. */
export default function Modal({ open, title, children, onClose, actions }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 2, 12, 0.78)',
        backdropFilter: 'blur(2px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pw-panel pw-panel--holo-top"
        style={{
          maxWidth: 460,
          width: '100%',
          padding: 24,
        }}
      >
        {title && (
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              letterSpacing: '-0.01em',
              marginBottom: 10,
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            color: 'var(--ink-secondary)',
            fontSize: 13,
            lineHeight: 1.55,
            marginBottom: 22,
          }}
        >
          {children}
        </div>
        <div className="flex gap-2 justify-end flex-wrap">
          {actions}
        </div>
      </div>
    </div>
  );
}
