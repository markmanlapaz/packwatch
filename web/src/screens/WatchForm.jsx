import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import Panel from '../components/Panel.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { extractSku, fetchProduct, productUrl } from '../lib/bestbuy.js';
import { handleWriteError } from './Watchlist.jsx';
import { formatPrice } from '../lib/format.js';

/**
 * Shared add/edit form. `mode` = 'add' | 'edit'.
 * When editing, `existing` is the watch being edited.
 */
export default function WatchForm({ mode, existing, wl }) {
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = mode === 'edit';

  const [url, setUrl] = useState(existing ? productUrl(existing.sku) : '');
  const [name, setName] = useState(existing?.name ?? '');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [maxPrice, setMaxPrice] = useState(existing?.maxPrice != null ? String(existing.maxPrice) : '');
  const [enabled, setEnabled] = useState(existing?.enabled !== false);
  // 'idle' | 'loading' | 'loaded' | 'warning' | 'error'
  const [fetchState, setFetchState] = useState(existing ? 'loaded' : 'idle');
  const [fetchMessage, setFetchMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const debounceRef = useRef(null);
  const lastFetchedSkuRef = useRef(existing?.sku ?? null);

  // Auto-fetch product details after the URL settles for 400ms.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (isEdit) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setFetchState('idle'); setFetchMessage(null);
      setName(''); setSku(''); setCurrentPrice(null);
      return;
    }
    const candidate = extractSku(trimmed);
    if (!candidate) {
      setFetchState('error');
      setFetchMessage("That doesn't look like a Best Buy CA URL.");
      setName(''); setSku(''); setCurrentPrice(null);
      return;
    }
    if (candidate === lastFetchedSkuRef.current) return;

    setFetchState('loading'); setFetchMessage(null);
    debounceRef.current = setTimeout(async () => {
      const result = await fetchProduct(trimmed);
      if (result.error) {
        setFetchState('error');
        setFetchMessage(result.error);
        setSku(result.sku || '');
        setName(''); setCurrentPrice(null);
        return;
      }
      lastFetchedSkuRef.current = result.sku;
      setSku(result.sku);
      setName(result.name || '');
      setCurrentPrice(result.price);
      if (result.warning) {
        setFetchState('warning');
        setFetchMessage(result.warning);
      } else {
        setFetchState('loaded');
        setFetchMessage(null);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [url, isEdit]);

  const id = useMemo(() => existing?.id ?? slugify(name || `bbca-${sku}`), [existing, name, sku]);

  const canSubmit =
    sku &&
    name &&
    (isEdit || fetchState !== 'loading') &&
    !busy;

  async function doSubmit(force = false) {
    setBusy(true);
    try {
      const payload = {
        id,
        name: name.trim(),
        retailer: 'bestbuy_ca',
        sku: String(sku).trim(),
        enabled,
      };
      const mp = parseFloat(maxPrice);
      if (!isNaN(mp) && mp > 0) payload.maxPrice = mp;

      if (isEdit) {
        await wl.updateWatch(existing.id, payload);
        toast.push({ kind: 'success', message: 'Watch updated.' });
      } else {
        const dupe = wl.watches.find((w) => w.id === payload.id || w.sku === payload.sku);
        if (dupe && !force) {
          setConfirmOverwrite({ payload, dupeName: dupe.name });
          setBusy(false);
          return;
        }
        if (dupe) {
          await wl.updateWatch(dupe.id, payload);
        } else {
          await wl.addWatch(payload);
        }
        toast.push({ kind: 'success', message: 'Watch committed.' });
      }
      navigate('/');
    } catch (err) {
      handleWriteError(err, toast, wl.refresh);
    } finally { setBusy(false); }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await wl.deleteWatch(existing.id);
      toast.push({ kind: 'success', message: 'Watch removed.' });
      navigate('/');
    } catch (err) {
      handleWriteError(err, toast, wl.refresh);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Shell lastCommittedAt={wl.lastCommittedAt}>
      <button
        type="button"
        className="pw-btn-ghost"
        onClick={() => navigate('/')}
        style={{ marginBottom: 22 }}
      >
        ← Back to watchlist
      </button>

      <div className="pw-form-wrap" style={{ maxWidth: 640, margin: '0 auto' }}>
        <Panel holoTop style={{ padding: 28 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 5vw, 38px)',
              letterSpacing: '-0.01em',
              marginBottom: 6,
            }}
          >
            {isEdit ? 'Edit watch' : 'Add a watch'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55, marginBottom: 22 }}>
            {isEdit
              ? 'Adjust the price ceiling, pause, or remove the watch entirely.'
              : 'Paste a Best Buy Canada product URL. We\'ll pull the SKU, title, and current price automatically.'}
          </p>

          {!isEdit && (
            <Field label="Product URL">
              <input
                className="pw-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.bestbuy.ca/en-ca/product/..."
                autoFocus
                spellCheck="false"
              />
            </Field>
          )}

          {!isEdit && (
            fetchState === 'idle' ? (
              <SkeletonPreview />
            ) : (
              <Preview
                state={fetchState}
                message={fetchMessage}
                name={name}
                sku={sku}
                price={currentPrice}
              />
            )
          )}

          {(isEdit || ['loaded', 'warning', 'error'].includes(fetchState)) && (
            <>
              <Field label="Name">
                <input
                  className="pw-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pokémon TCG: ..."
                />
              </Field>
              <Field label="SKU">
                <input
                  className="pw-input"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="17890123"
                  inputMode="numeric"
                  disabled={isEdit}
                />
              </Field>

              <Field label="Max price (CAD) — optional">
                <input
                  className="pw-input"
                  type="text"
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="79.99"
                />
              </Field>

              <label
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-secondary)',
                  marginBottom: 22,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                <span>Enabled — uncheck to pause without deleting.</span>
              </label>

              <div className="flex gap-2 flex-wrap">
                {isEdit && (
                  <button
                    type="button"
                    className="pw-btn-danger"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="pw-btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => doSubmit(false)}
                  disabled={!canSubmit}
                >
                  {busy ? 'Saving…' : isEdit ? 'Save changes →' : 'Commit watch →'}
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Modal
        open={confirmDelete}
        title="Remove this watch?"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <button className="pw-btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </button>
            <button className="pw-btn-danger" onClick={doDelete} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </>
        }
      >
        This deletes <strong>{existing?.name}</strong> from <code>config/watchlist.json</code>.
        Stock state for this SKU will be lost.
      </Modal>

      <Modal
        open={!!confirmOverwrite}
        title="A watch already exists for this SKU"
        onClose={() => setConfirmOverwrite(null)}
        actions={
          <>
            <button className="pw-btn-ghost" onClick={() => setConfirmOverwrite(null)} disabled={busy}>
              Cancel
            </button>
            <button
              className="pw-btn-primary"
              style={{ width: 'auto' }}
              onClick={() => { const p = confirmOverwrite; setConfirmOverwrite(null); doSubmit(true); }}
              disabled={busy}
            >
              Overwrite
            </button>
          </>
        }
      >
        <strong>{confirmOverwrite?.dupeName}</strong> already watches this SKU. Overwrite it
        with the new settings?
      </Modal>
    </Shell>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label
        className="block uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'var(--ink-tertiary)',
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Preview({ state, message, name, sku, price }) {
  if (state === 'loading') {
    return (
      <div style={previewBoxStyle('var(--accent-cyan)')}>
        <PreviewLabel color="var(--accent-cyan)">FETCHING</PreviewLabel>
        <div className="pw-shimmer" style={{ height: 18, borderRadius: 3, marginTop: 6 }} />
        <div className="pw-shimmer" style={{ height: 12, width: '40%', borderRadius: 3, marginTop: 14 }} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={previewBoxStyle('var(--accent-amber)')}>
        <PreviewLabel color="var(--accent-amber)">MANUAL ENTRY</PreviewLabel>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--accent-amber)',
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {message} Type the name below.
        </p>
      </div>
    );
  }

  // 'loaded' or 'warning' — both show the detected fields
  const accent = state === 'warning' ? 'var(--accent-amber)' : 'var(--accent-cyan)';
  const label = state === 'warning' ? 'DETECTED — PARTIAL' : 'DETECTED';

  return (
    <div style={previewBoxStyle(accent)}>
      <PreviewLabel color={accent}>{label}</PreviewLabel>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          color: 'var(--ink-primary)',
          marginBottom: 10,
          marginTop: 4,
          lineHeight: 1.25,
        }}
      >
        {name || <span style={{ color: 'var(--ink-tertiary)', fontStyle: 'italic' }}>Set the name below</span>}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginTop: 6,
        }}
      >
        <PreviewCell label="SKU" value={sku} />
        <PreviewCell label="Retailer" value="Best Buy CA" />
        <PreviewCell label="Current price" value={formatPrice(price)} />
      </div>
      {state === 'warning' && message && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-amber)',
            lineHeight: 1.5,
            marginTop: 12,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function SkeletonPreview() {
  return (
    <div style={previewBoxStyle('var(--ink-dim)')}>
      <PreviewLabel color="var(--ink-tertiary)">AWAITING URL</PreviewLabel>
      <div
        className="pw-skeleton-bar"
        style={{ height: 18, width: '70%', marginTop: 4, marginBottom: 10 }}
        aria-hidden="true"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginTop: 6,
        }}
        aria-hidden="true"
      >
        <SkeletonCell label="SKU" />
        <SkeletonCell label="Retailer" />
        <SkeletonCell label="Current price" />
      </div>
    </div>
  );
}

function SkeletonCell({ label }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div
        className="uppercase"
        style={{
          color: 'var(--ink-dim)',
          letterSpacing: '0.1em',
          fontSize: 9,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div className="pw-skeleton-bar" style={{ height: 13, width: '75%' }} />
    </div>
  );
}

function previewBoxStyle(borderColor) {
  const border =
    borderColor === 'var(--accent-cyan)' ? 'rgba(53, 240, 229, 0.25)' :
    borderColor === 'var(--accent-amber)' ? 'rgba(255, 179, 71, 0.35)' :
    'rgba(58, 62, 90, 0.4)';
  return {
    margin: '20px 0 22px',
    padding: 16,
    background: 'var(--bg-deep)',
    border: `1px solid ${border}`,
    borderRadius: 4,
    minHeight: 92,
    position: 'relative',
  };
}

function PreviewLabel({ children, color }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: -7,
        left: 14,
        padding: '0 8px',
        background: 'var(--bg-panel)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.2em',
        color,
      }}
    >
      {children}
    </span>
  );
}

function PreviewCell({ label, value }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div
        className="uppercase"
        style={{
          color: 'var(--ink-tertiary)',
          letterSpacing: '0.1em',
          fontSize: 9,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--ink-primary)', fontSize: 13 }}>{value}</div>
    </div>
  );
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `watch-${Date.now()}`;
}
