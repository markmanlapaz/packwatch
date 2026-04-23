import React, { useState } from 'react';
import BrandMark from '../components/BrandMark.jsx';
import Panel from '../components/Panel.jsx';
import { setAuth } from '../lib/auth.js';
import { verifyRepo, verifyToken } from '../lib/github.js';

export default function FirstRun() {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [login, setLogin] = useState(null);

  async function onSubmitToken(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { login } = await verifyToken(token.trim());
      setLogin(login);
      if (!owner) setOwner(login);
      setStep(2);
    } catch (err) {
      setError(err.message || 'PAT validation failed.');
    } finally { setBusy(false); }
  }

  async function onSubmitRepo(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyRepo(token.trim(), owner.trim(), repo.trim());
      setAuth({ token: token.trim(), owner: owner.trim(), repo: repo.trim() });
      // Hard reload — RootGate reads hasAuth() on mount, so a SPA navigate
      // to "/" (where we already are) wouldn't re-evaluate it.
      window.location.hash = '#/';
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Repo check failed.');
    } finally { setBusy(false); }
  }

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 4vw, 40px)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <BrandMark size="lg" />
          <div
            style={{
              marginTop: 10,
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 18,
              color: 'var(--ink-secondary)',
            }}
          >
            — sealed product radar
          </div>
        </div>

        <Panel holoTop style={{ padding: 26 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--accent-cyan)',
              marginBottom: 6,
            }}
          >
            STEP {step} OF 2
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              letterSpacing: '-0.01em',
              marginBottom: 6,
            }}
          >
            {step === 1 ? 'Connect your repo' : 'Point at the watchlist'}
          </h1>
          <p
            style={{
              color: 'var(--ink-secondary)',
              fontSize: 13,
              lineHeight: 1.55,
              marginBottom: 22,
            }}
          >
            {step === 1 ? (
              <>
                Paste a GitHub <strong>fine-grained PAT</strong> with{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>Contents: Read &amp; Write</code>{' '}
                on the repo where <code>config/watchlist.json</code> lives.
                The token never leaves your browser.
              </>
            ) : (
              <>
                Authenticated as <strong style={{ color: 'var(--accent-cyan)' }}>@{login}</strong>.
                Tell us which repo holds the watchlist.
              </>
            )}
          </p>

          {step === 1 && (
            <form onSubmit={onSubmitToken}>
              <Field label="Personal Access Token">
                <input
                  className="pw-input"
                  type="password"
                  autoComplete="off"
                  spellCheck="false"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_..."
                  required
                />
              </Field>

              {error && <ErrorLine>{error}</ErrorLine>}

              <button
                type="submit"
                className="pw-btn-primary"
                disabled={busy || !token.trim()}
                style={{ marginTop: 6 }}
              >
                {busy ? 'Verifying…' : 'Continue →'}
              </button>

              <p style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-tertiary)', lineHeight: 1.5 }}>
                Generate one at{' '}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-cyan)' }}
                >
                  github.com/settings/personal-access-tokens
                </a>.
              </p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={onSubmitRepo}>
              <Field label="Owner (user or org)">
                <input
                  className="pw-input"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder={login || 'your-username'}
                  required
                />
              </Field>
              <Field label="Repo name">
                <input
                  className="pw-input"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="packwatch"
                  required
                />
              </Field>

              {error && <ErrorLine>{error}</ErrorLine>}

              <div className="flex gap-2 flex-wrap">
                <button type="button" className="pw-btn-ghost" onClick={() => setStep(1)} disabled={busy}>
                  ← Back
                </button>
                <button
                  type="submit"
                  className="pw-btn-primary"
                  disabled={busy || !owner.trim() || !repo.trim()}
                  style={{ flex: 1 }}
                >
                  {busy ? 'Checking watchlist…' : 'Open dashboard →'}
                </button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
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

function ErrorLine({ children }) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: 14,
        padding: '10px 12px',
        background: 'rgba(255, 62, 165, 0.08)',
        border: '1px solid rgba(255, 62, 165, 0.3)',
        borderRadius: 4,
        color: '#ff7cc1',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}
