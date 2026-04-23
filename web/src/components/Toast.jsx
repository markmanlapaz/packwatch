import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

let _id = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((opts) => {
    const id = ++_id;
    const next = {
      id,
      kind: opts.kind || 'info',
      message: typeof opts === 'string' ? opts : opts.message,
      ttl: opts.ttl ?? 4500,
    };
    setItems((all) => [...all, next]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 60,
          maxWidth: 'min(420px, calc(100vw - 40px))',
        }}
      >
        {items.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.ttl);
    return () => clearTimeout(timer);
  }, [toast.ttl, onDismiss]);

  const accent =
    toast.kind === 'error'   ? 'var(--accent-magenta)' :
    toast.kind === 'success' ? 'var(--accent-mint)'    :
    toast.kind === 'warn'    ? 'var(--accent-amber)'   :
                               'var(--accent-cyan)';

  return (
    <div
      role="status"
      onClick={onDismiss}
      className="pw-panel pw-panel--holo-top"
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--ink-primary)',
        borderColor: accent,
      }}
    >
      <span style={{ color: accent, marginRight: 10, fontWeight: 700 }}>
        {toast.kind === 'error' ? '✕' : toast.kind === 'success' ? '✓' : 'ℹ'}
      </span>
      {toast.message}
    </div>
  );
}
