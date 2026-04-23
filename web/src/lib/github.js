import { Octokit } from '@octokit/rest';
import { getAuth } from './auth.js';

const WATCHLIST_PATH = 'config/watchlist.json';
const STATE_PATH = 'state.json';

/* ----- error types ------------------------------------------------------- */

export class GhAuthError extends Error {
  constructor(msg = 'GitHub auth failed — check your PAT.') {
    super(msg); this.name = 'GhAuthError';
  }
}
export class GhNotFoundError extends Error {
  constructor(msg = 'File not found in repo.') {
    super(msg); this.name = 'GhNotFoundError';
  }
}
export class GhConflictError extends Error {
  constructor(msg = 'Watchlist changed since you loaded it. Reload before saving.') {
    super(msg); this.name = 'GhConflictError';
  }
}
export class GhRateLimitError extends Error {
  constructor(msg = 'GitHub API rate limit reached. Wait a minute and retry.') {
    super(msg); this.name = 'GhRateLimitError';
  }
}
export class GhNetworkError extends Error {
  constructor(msg = 'Could not reach GitHub.') {
    super(msg); this.name = 'GhNetworkError';
  }
}

/* ----- client ------------------------------------------------------------ */

let _client = null;
let _clientToken = null;

function client() {
  const auth = getAuth();
  if (!auth) throw new GhAuthError('No PAT stored. Visit setup.');
  if (!_client || _clientToken !== auth.token) {
    _client = new Octokit({ auth: auth.token, userAgent: 'packwatch-web/0.1' });
    _clientToken = auth.token;
  }
  return { gh: _client, owner: auth.owner, repo: auth.repo };
}

function classify(err) {
  if (err instanceof GhAuthError || err instanceof GhNotFoundError ||
      err instanceof GhConflictError || err instanceof GhRateLimitError ||
      err instanceof GhNetworkError) return err;

  const status = err?.status;
  if (status === 401) return new GhAuthError('PAT rejected. It may be expired or lack repo access.');
  if (status === 403) {
    const remaining = err?.response?.headers?.['x-ratelimit-remaining'];
    if (remaining === '0') return new GhRateLimitError();
    return new GhAuthError('PAT lacks Contents: Read & Write on this repo.');
  }
  if (status === 404) return new GhNotFoundError();
  if (status === 409 || status === 422) return new GhConflictError();
  if (!status) return new GhNetworkError(err?.message || 'Network error');
  return err;
}

/* ----- base64 helpers (UTF-8 safe) -------------------------------------- */

function decodeBase64(b64) {
  const cleaned = b64.replace(/\n/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ----- public API ------------------------------------------------------- */

/** Verify that the stored PAT is valid by hitting /user. */
export async function verifyToken(token) {
  try {
    const gh = new Octokit({ auth: token, userAgent: 'packwatch-web/0.1' });
    const { data } = await gh.users.getAuthenticated();
    return { ok: true, login: data.login };
  } catch (err) {
    throw classify(err);
  }
}

/** Verify the configured repo is reachable + watchlist exists. */
export async function verifyRepo(token, owner, repo) {
  try {
    const gh = new Octokit({ auth: token, userAgent: 'packwatch-web/0.1' });
    const { data } = await gh.repos.getContent({ owner, repo, path: WATCHLIST_PATH });
    if (Array.isArray(data) || data.type !== 'file') {
      throw new GhNotFoundError('config/watchlist.json is not a file in this repo.');
    }
    return { ok: true };
  } catch (err) {
    throw classify(err);
  }
}

/** Reads config/watchlist.json. Returns { watches, sha }. */
export async function readWatchlist() {
  try {
    const { gh, owner, repo } = client();
    const { data } = await gh.repos.getContent({
      owner, repo, path: WATCHLIST_PATH,
      // Fresh content every read — avoid GH caching after a write.
      headers: { 'If-None-Match': '' },
    });
    if (Array.isArray(data) || data.type !== 'file') throw new GhNotFoundError();

    let watches = [];
    try {
      const json = JSON.parse(decodeBase64(data.content));
      watches = Array.isArray(json?.watches) ? json.watches : [];
    } catch {
      throw new Error('watchlist.json is malformed JSON. Fix it on GitHub before continuing.');
    }
    return { watches, sha: data.sha };
  } catch (err) { throw classify(err); }
}

/** Writes the watchlist back. `sha` is the blob SHA from the prior read. */
export async function writeWatchlist(watches, sha, message = 'web: update watchlist') {
  try {
    const { gh, owner, repo } = client();
    const body = JSON.stringify({ watches }, null, 2) + '\n';
    const { data } = await gh.repos.createOrUpdateFileContents({
      owner, repo, path: WATCHLIST_PATH,
      message,
      content: encodeBase64(body),
      sha,
    });
    return { sha: data.content?.sha };
  } catch (err) { throw classify(err); }
}

/** Reads state.json. Returns { state, lastCommittedAt } — both null-safe. */
export async function readState() {
  try {
    const { gh, owner, repo } = client();
    const [contents, commits] = await Promise.allSettled([
      gh.repos.getContent({ owner, repo, path: STATE_PATH, headers: { 'If-None-Match': '' } }),
      gh.repos.listCommits({ owner, repo, path: STATE_PATH, per_page: 1 }),
    ]);

    let state = {};
    if (contents.status === 'fulfilled' && !Array.isArray(contents.value.data)
        && contents.value.data.type === 'file') {
      try { state = JSON.parse(decodeBase64(contents.value.data.content)); }
      catch { state = {}; }
    } else if (contents.status === 'rejected' && contents.reason?.status !== 404) {
      throw contents.reason;
    }

    let lastCommittedAt = null;
    if (commits.status === 'fulfilled' && commits.value.data[0]) {
      lastCommittedAt = commits.value.data[0].commit?.committer?.date
        ?? commits.value.data[0].commit?.author?.date
        ?? null;
    }
    return { state, lastCommittedAt };
  } catch (err) { throw classify(err); }
}
