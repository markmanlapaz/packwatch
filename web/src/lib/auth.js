const KEY = 'packwatch.auth';

/**
 * @typedef {Object} Auth
 * @property {string} token  GitHub PAT (fine-grained, Contents: Read & Write)
 * @property {string} owner  Repo owner / org
 * @property {string} repo   Repo name
 */

/** @returns {Auth | null} */
export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.owner || !parsed?.repo) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Auth} auth */
export function setAuth(auth) {
  localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

export function hasAuth() {
  return getAuth() !== null;
}
