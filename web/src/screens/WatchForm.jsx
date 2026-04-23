import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell.jsx';
import Panel from '../components/Panel.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { extractSku, fetchProduct, productUrl } from '../lib/bestbuy.js';
import { handleWriteError } from './Watchlist.jsx';
import { formatPrice } from '../lib/format.js';
import { RETAILERS } from '../../../shared/schema.js';

/**
 * Shared add/edit form. `mode` = 'add' | 'edit'.
 * When editing, `existing` is the watch being edited.
 *
 * Retailer branching:
 *   - Auto-fetch retailers (bestbuy_ca) get the legacy paste-URL → auto-populate flow.
 *   - Manual retailers (ebgames_ca) validate the URL and require the user to type
 *     the name + max price. See CLAUDE.md "When modifying the UI" rules.
 */
export default function WatchForm({ mode, existing, wl }) {
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = mode === 'edit';

  // Retailer state. Once chosen for a new watch, switching it wipes URL-derived
  // state so we don't accidentally persist Best Buy's SKU under an EB Games watch.
  const initialRetailer = existing?.retailer ?? 'bestbuy_ca';
  const [retailer, setRetailer] = useState(initialRetailer);
  const retailerMeta = RETAILERS[retailer] ?? RETAILERS.bestbuy_ca;
  const autoFetch = retailerMeta.supportsAutoFetch;

  const initialUrl = existing
    ? existing.url ?? (existing.sku ? productUrl(existing.sku) : '')
    : '';

  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(existing?.name ?? '');
  const [sku, setSku] = useState(existing?.sku ?? (existing?.url ? retailerMeta.skuFromUrl(existing.url) ?? '' : ''));
  const [currentPrice, setCurrentPrice] = useState(null);
  const [maxPrice, setMaxPrice] = useState(existing?.maxPrice != null ? String(existing.maxPrice) : '');
  const [enabled, setEnabled] = useState(existing?.enabled !== false);
  // 'idle' | 'loading' | 'loaded' | 'warning' | 'error' | 'manual'
  //  - 'manual' is used by non-auto-fetch retailers once the URL validates.
  const [fetchState, setFetchState] = useState(existing ? (autoFetch ? 'loaded' : 'manual') : 'idle');
  const [fetchMessage, setFetchMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const debounceRef = useRef(null);
  const lastFetchedKeyRef = useRef(
    existing ? (autoFetch ? existing.sku ?? null : existing.url ?? null) : null
  );

  // Auto-fetch flow — Best Buy CA only. Triggers on URL settle.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (isEdit) return;
    if (!autoFetch) return;
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
    if (candidate === lastFetchedKeyRef.current) return;

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
      lastFetchedKeyRef.current = result.sku;
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
  }, [url, isEdit, autoFetch]);

  // Manual validation flow — retailer is non-auto-fetch. URL just needs to
  // match the retailer's pattern; SKU is extracted for display only.
  useEffect(() => {
    if (isEdit) return;
    if (autoFetch) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setFetchState('idle'); setFetchMessage(null);
      setSku(''); setCurrentPrice(null);
      return;
    }
    if (!retailerMeta.urlPattern.test(trimmed)) {
      setFetchState('error');
      setFetchMessage(`That doesn't look like a ${retailerMeta.label} URL.`);
      setSku('');
      return;
    }
    const extractedSku = retailerMeta.skuFromUrl(trimmed);
    if (!extractedSku) {
      setFetchState('error');
      setFetchMessage(`Couldn't find a SKU in that ${retailerMeta.label} URL.`);
      setSku('');
      return;
    }
    lastFetchedKeyRef.current = trimmed;
    setSku(extractedSku);
    setFetchState('manual');
    setFetchMessage(null);
  }, [url, isEdit, autoFetch, retailer]);

  // When the retailer changes on an add form, reset URL-derived state so we
  // don't persist stale values from the previous selection.
  function onRetailerChange(nextKey) {
    if (nextKey === retailer) return;
    setRetailer(nextKey);
    if (isEdit) return;
    setUrl('');
    setName('');
    setSku('');
    setCurrentPrice(null);
    setFetchState('idle');
    setFetchMessage(null);
    lastFetchedKeyRef.current = null;
  }

  const id = useMemo(() => {
    if (existing?.id) return existing.id;
    const base = name || `${retailer.split('_')[0]}-${sku || Date.now()}`;
    return slugify(base);
  }, [existing, name, sku, retailer]);

  const canSubmit =
    name &&
    sku &&
    (autoFetch ? (isEdit || fetchState !== 'loading') : fetchState === 'manual' || isEdit) &&
    !busy;

  async function doSubmit(force = false) {
    setBusy(true);
    try {
      const payload = {
        id,
        name: name.trim(),
        retailer,
        enabled,
      };
      // Retailer-specific identifier field — source of truth for the adapter.
      if (retailerMeta.watchField === 'url') {
        payload.url = url.trim();
      } else {
        payload.sku = String(sku).trim();
      }
      const mp = parseFloat(maxPrice);
      if (!isNaN(mp) && mp > 0) payload.maxPrice = mp;

      if (isEdit) {
        await wl.updateWatch(existing.id, payload);
        toast.push({ kind: 'success', message: 'Watch updated.' });
      } else {
        const dupe = wl.watches.find((w) => {
          if (w.id === payload.id) return true;
          if (retailerMeta.watchField === 'url') return w.retailer === retailer && w.url === payload.url;
          return w.retailer === retailer && w.sku === payload.sku;
        });
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

  const retailerOptions = Object.values(RETAILERS);
  const urlPlaceholder = autoFetch
    ? 'https://www.bestbuy.ca/en-ca/product/...'
    : 'https://www.ebgames.ca/.../<sku>.html';
  const urlHelpCopy = autoFetch
    ? "Paste a Best Buy Canada product URL. We'll pull the SKU, title, and current price automatically."
    : `Paste an ${retailerMeta.label} product URL. Auto-fetch isn't wired for this retailer yet — you'll enter the name manually.`;

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
              : urlHelpCopy}
          </p>

          <Field label="Retailer">
            <select
              className="pw-input"
              value={retailer}
              onChange={(e) => onRetailerChange(e.target.value)}
              disabled={isEdit}
              style={selectStyle}
            >
              {retailerOptions.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </Field>

          {!isEdit && (
            <Field label="Product URL">
              <input
                className="pw-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={urlPlaceholder}
                autoFocus
                spellCheck="false"
              />
            </Field>
          )}

          {!isEdit && (
            fetchState === 'idle' ? (
              <SkeletonPreview autoFetch={autoFetch} />
            ) : (
              <Preview
                state={fetchState}
                message={fetchMessage}
                name={name}
                sku={sku}
                price={currentPrice}
                retailerLabel={retailerMeta.label}
                autoFetch={autoFetch}
              />
            )
          )}

          {(isEdit || ['loaded', 'warning', 'error', 'manual'].includes(fetchState)) && (
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
                  disabled={isEdit || !autoFetch}
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
        title="A watch already exists for this product"
        onClose={() => setConfirmOverwrite(null)}
        actions={
          <>
            <button className="pw-btn-ghost" onClick={() => setConfirmOverwrite(null)} disabled={busy}>
              Cancel
            </button>
            <button
              className="pw-btn-primary"
              style={{ width: 'auto' }}
              onClick={() => { setConfirmOverwrite(null); doSubmit(true); }}
              disabled={busy}
            >
              Overwrite
            </button>
          </>
        }
      >
        <strong>{confirmOverwrite?.dupeName}</strong> already watches this product. Overwrite it
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

function Preview({ state, message, name, sku, price, retailerLabel, autoFetch }) {
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

  if (state === 'manual') {
    // Non-auto-fetch retailers: URL validated, SKU extracted, user fills in the rest.
    return (
      <div style={previewBoxStyle('var(--accent-violet)')}>
        <PreviewLabel color="var(--accent-violet)">URL VALIDATED</PreviewLabel>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 18,
            color: 'var(--ink-secondary)',
            marginBottom: 10,
            marginTop: 4,
            lineHeight: 1.25,
          }}
        >
          Name the product below.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginTop: 6,
          }}
        >
          <PreviewCell label="SKU" value={sku} />
          <PreviewCell label="Retailer" value={retailerLabel} />
        </div>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-tertiary)',
            lineHeight: 1.5,
            marginTop: 12,
          }}
        >
          Price auto-fetch is deferred until a proxy ships — enter a max price manually if you want a ceiling.
        </p>
      </div>
    );
  }

  // 'loaded' or 'warning' — Best Buy auto-fetch result
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
        <PreviewCell label="Retailer" value={retailerLabel} />
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

function SkeletonPreview({ autoFetch }) {
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
          gridTemplateColumns: autoFetch ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          gap: 10,
          marginTop: 6,
        }}
        aria-hidden="true"
      >
        <SkeletonCell label="SKU" />
        <SkeletonCell label="Retailer" />
        {autoFetch && <SkeletonCell label="Current price" />}
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
    borderColor === 'var(--accent-violet)' ? 'rgba(138, 92, 255, 0.35)' :
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

const selectStyle = {
  // Keep the caret visible against the dark panel — default browser chrome
  // tends to invert to black/transparent, which disappears here.
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage:
    'linear-gradient(45deg, transparent 50%, var(--ink-tertiary) 50%), linear-gradient(135deg, var(--ink-tertiary) 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 18px) center, calc(100% - 13px) center',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
  paddingRight: 32,
  cursor: 'pointer',
};

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `watch-${Date.now()}`;
}
