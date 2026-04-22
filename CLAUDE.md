# CLAUDE.md
This file guides Claude Code when working on this repository. Read it fully before making changes.
## Project: PackWatch
A personal tool that monitors Best Buy Canada for Pokemon TCG sealed product restocks (ETBs, booster boxes, booster bundles) and sends Discord + email notifications when items go from out-of-stock to in-stock. Includes a mobile-friendly PWA for managing the watchlist from anywhere.
**This is a single-user tool, not a SaaS product.** Do not add auth, multi-tenancy, user management, billing, or any public-facing features. Optimize for simplicity and reliability over scale.
## Monorepo Structure
```
packwatch/
├── .github/workflows/
│   ├── check-stock.yml        # Cron every 5 min (watcher)
│   └── deploy-web.yml         # Build web/, deploy to GitHub Pages on push
├── config/
│   └── watchlist.json         # Source of truth for watches (read by watcher, written by UI)
├── shared/
│   └── schema.js              # Watch entry shape, retailer registry — imported by both sides
├── src/                       # The watcher (Node.js script)
│   ├── index.js
│   ├── state.js
│   ├── adapters/
│   └── notify/
├── state.json                 # Last known stock state (committed after each run)
├── web/                       # The PWA (Vite + React)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json               # Root — watcher deps only
├── .env.example
└── README.md
```
Two `package.json` files keep the watcher's CI fast — the Actions runner for the cron doesn't pull React and Vite.
## Watcher (`src/`)
### Tech stack
- **Runtime**: Node.js 20+ (ESM, `"type": "module"`)
- **Scheduler**: GitHub Actions cron, every 5 minutes
- **State**: `state.json` in repo root, committed after each run
- **Config**: `config/watchlist.json`, hand-edited via PR or written via the UI
- **HTTP**: native `fetch` (no axios, no got)
- **HTML parsing**: not needed for v1 (Best Buy CA uses JSON API). If needed later, use `cheerio`.
- **Notifications**: Discord webhook + Resend API
- **No database, no ORM, no framework.**
### Core loop (`src/index.js`)
1. Load `config/watchlist.json`
2. Load previous `state.json` (or `{}` if missing)
3. For each enabled watch:
   - Dispatch to the correct retailer adapter via `src/adapters/index.js`
   - Adapter returns normalized `WatchResult`
   - Diff against previous state
   - If transition from OOS → in-stock AND within `maxPrice`, send notifications
   - Record result in next state
   - Errors in one adapter must not kill the run — catch, log, preserve previous state for that watch
4. Write new `state.json`
5. GitHub Actions commits state back to repo
### Adapter contract
Every retailer adapter in `src/adapters/` exports a default object:
```js
{
  name: 'bestbuy_ca',
  async check(watch) { /* returns WatchResult */ }
}
```
`WatchResult` shape (defined in `shared/schema.js`):
```js
{
  watchId: string,
  name: string,
  retailer: string,
  inStock: boolean,
  price: number | null,
  url: string,
  checkedAt: string,           // ISO 8601
  confidence: 'high' | 'low'
}
```
If an adapter cannot parse the retailer response, it **throws**. Never assume in-stock on parse failure — false-positive notifications are worse than missed restocks.
### Watch entry shape (`config/watchlist.json`)
```json
{
  "watches": [
    {
      "id": "unique-slug",
      "name": "Human Readable Name",
      "retailer": "bestbuy_ca",
      "sku": "17890123",
      "maxPrice": 79.99,
      "enabled": true
    }
  ]
}
```
- `id`: stable slug, used as state key; changing it resets state for that watch
- `enabled`: optional, defaults to `true`; `false` skips the watch
- Retailer-specific fields (`sku` for Best Buy) live alongside common fields
- This shape is canonical — the UI and watcher both import from `shared/schema.js`
## Web UI (`web/`)
A mobile-first PWA for managing the watchlist from any device. It reads and writes `config/watchlist.json` directly via the GitHub REST API. It does not talk to the watcher, and the watcher does not know it exists.
### Tech stack
- **Framework**: Vite + React 18 (no SSR, no Next.js)
- **Language**: JavaScript (no TypeScript for v1)
- **Styling**: Tailwind CSS v4 + CSS variables for the holo-foil/CRT design tokens
- **GitHub API**: `@octokit/rest`
- **Auth**: GitHub Personal Access Token stored in `localStorage`. The user pastes their PAT once on first visit. No backend, no OAuth — this is a single-user tool.
- **Hosting**: GitHub Pages, deployed automatically from `main` via `.github/workflows/deploy-web.yml`
- **PWA**: manifest + service worker via `vite-plugin-pwa`
### Data flow
```
Browser (PWA)
    ↓ Octokit: GET /repos/{owner}/{repo}/contents/config/watchlist.json
GitHub API
    ↓
config/watchlist.json (in repo)
    ↑
Browser (PWA)
    ↓ Octokit: PUT /repos/{owner}/{repo}/contents/config/watchlist.json
```
Reads hit `raw.githubusercontent.com` (fast, cached, no auth needed for public repos — but since this repo is private, Octokit authenticated reads are used throughout).
Writes go via GitHub's Contents API with the blob SHA for optimistic concurrency. If the SHA has changed between read and write, the UI prompts the user to reload before saving.
### Aesthetic direction — holo-foil / CRT
Committed aesthetic — do not drift toward generic dashboard styling.
**Palette:**
- `--bg-base`: `#0a0514` (deep space purple-black)
- `--bg-deep`: `#06020c`
- `--bg-panel`: `#120a22`
- `--bg-panel-hi`: `#1a0f2e`
- `--ink-primary`: `#e8f6ff`
- `--ink-secondary`: `#9ea8c7`
- `--ink-tertiary`: `#5a6286`
- `--ink-dim`: `#3a3e5a`
- `--accent-cyan`: `#35f0e5` (primary action)
- `--accent-magenta`: `#ff3ea5` (foil accent)
- `--accent-violet`: `#8a5cff`
- `--accent-mint`: `#7dffb4` (in-stock / success)
- `--accent-amber`: `#ffb347` (warnings)
**Holographic gradient** (the signature element):
```css
--holo-gradient: linear-gradient(
  105deg,
  #ff3ea5 0%,
  #8a5cff 22%,
  #35f0e5 50%,
  #7dffb4 74%,
  #ffb347 100%
);
```
Animated on brand mark, foil-bars on watch rows, and the top edge of the add form.
**Typography:**
- Display: `Instrument Serif` (italic welcomed, editorial feel)
- CRT headline: `VT323` (used sparingly — brand mark, status counters)
- Monospace: `JetBrains Mono` (all metadata, SKUs, timestamps, button labels)
- Body UI: `Inter Tight` (never plain `Inter`)
**Do not use**: Space Grotesk, Roboto, Arial, system fonts, or any other generic choice.
**Texture:**
- Subtle CRT scanlines on `body` (`repeating-linear-gradient`, opacity ~0.012)
- SVG grain overlay via `::before` pseudo-element, `mix-blend-mode: overlay`, opacity ~0.05
- No drop shadows, no heavy blur. Glow effects via `box-shadow` with colored spread for focus states and hover on primary actions.
**Motion:**
- The `--holo-gradient` animates with `background-position` keyframes on a ~8s loop
- Dot indicators pulse (2s ease-in-out)
- Row hover: subtle background shift to `--bg-panel-hi`
- No scroll-triggered animations, no confetti, no gratuitous effects
Reference: the mockup at `web/docs/mockup-reference.html` (to be copied from our design review session) is the source of truth for look and feel.
### Screens (v1)
1. **First-run setup** — prompt for GitHub PAT + repo coordinates (owner/repo). Validate by making a test API call. Store in `localStorage` as `packwatch.auth`.
2. **Watchlist** — list of active watches with foil-bar, name, metadata row (retailer / SKU / max price / stock badge), edit/pause actions. Header shows total count and last-run timestamp.
3. **Add watch** — paste Best Buy CA URL, auto-fetch product name + current price + SKU, user sets `maxPrice`, commit to `watchlist.json`.
4. **Edit watch** — same form as add, pre-filled, with delete button.
### What the UI does NOT do
- Does not poll retailers (that's the watcher's job)
- Does not show notification history (would need a DB)
- Does not show price charts
- Does not manage GitHub Secrets (user does that once in GitHub's UI)
- Does not run the watcher (cron-only)
### GitHub API integration
All API calls go through a thin wrapper in `web/src/lib/github.js` that handles:
- PAT injection from `localStorage`
- Base64 encode/decode for file contents
- SHA tracking for concurrent-write safety
- Retry on rate limit (5000 req/hr is plenty — but handle gracefully)
- Network errors surfaced to the user as toasts, not silent failures
### Best Buy CA product data fetch (UI side)
The UI needs to auto-fill product details from a pasted URL. It hits the same endpoint the watcher uses:
```
https://www.bestbuy.ca/ecomm-api/availability/products?skus={sku}
```
...plus a product details endpoint for the name:
```
https://www.bestbuy.ca/ecomm-api/products/{sku}?lang=en-CA
```
Both are public JSON endpoints. No CORS issues observed as of authoring; if CORS breaks in the future, fall back to asking the user to paste the name and price manually.
## Design Principles (both watcher and UI)
1. **Silent by default.** No heartbeats, no daily summaries, no "still OOS" updates.
2. **Fail loud in logs, fail quiet in notifications.** Never send notifications on uncertain parses.
3. **Idempotent runs.** State diffing prevents duplicate notifications.
4. **Polite scraping.** Jittered delays, browser-like User-Agent, exponential backoff on 429/5xx.
5. **Adapter isolation.** Each retailer is self-contained.
6. **No secrets in code.** Watcher uses GitHub Secrets; UI uses `localStorage` PAT (user-controlled).
7. **Aesthetic discipline.** The UI commits to holo-foil/CRT. No generic dashboard components.
## Environment Variables (Watcher)
Required:
- `DISCORD_WEBHOOK_URL`
- `RESEND_API_KEY`
- `NOTIFY_EMAIL`
- `RESEND_FROM_EMAIL`
Optional:
- `LOG_LEVEL` — `debug` | `info` | `warn` | `error` (default `info`)
- `DRY_RUN` — `true` skips notifications and state writes
The UI does not use `.env`; all config comes from the user via the first-run setup UI.
## Working With This Codebase
### When adding a new retailer adapter
1. Create `src/adapters/<retailer>-<country>.js`
2. Export default object with `name` and `async check(watch)`
3. Register in `src/adapters/index.js`
4. Add the retailer key to `shared/schema.js` retailer registry so the UI can offer it
5. Prefer JSON APIs over HTML scraping
6. Document the endpoint in a comment at the top of the adapter
### When modifying the core watcher loop
- Preserve silent-by-default behavior
- Preserve error isolation between adapters
- Preserve idempotency
### When modifying the UI
- Preserve the aesthetic direction (holo-foil/CRT, palette, typography)
- Preserve single-user assumptions (no auth flows beyond PAT, no multi-tenancy)
- Preserve offline-friendliness where possible (PWA caching)
- New screens should feel native to the existing two — same grid, same motif, same motion language
### When modifying notifications
- Discord and email via `Promise.allSettled` — one failing doesn't block the other
- Include product name, retailer, price, and direct URL in every notification
- Low-confidence results get ⚠️ prefix
## What NOT to Build
Out of scope for v1 unless explicitly requested:
- Auto-checkout or cart automation
- Headless browser scraping (Playwright/Puppeteer)
- Multi-user / auth / billing
- SMS notifications
- Price history tracking or charts
- Additional retailers beyond Best Buy CA
- Heartbeat / health-check notifications
- Notification history UI
- TypeScript (keep it JS for v1)
## Local Development
**Watcher:**
```bash
npm install
cp .env.example .env   # Fill in values
DRY_RUN=true node src/index.js
```
**UI:**
```bash
cd web
npm install
npm run dev            # Vite dev server at http://localhost:5173
```
## Common Pitfalls
- **Don't use `axios`.** Native `fetch` works everywhere.
- **Don't commit `.env`.** Gitignored; verify before pushing.
- **Don't notify on adapter errors.** Log them.
- **Don't poll more frequently than every 5 min.** GitHub Actions cron minimum.
- **Don't modify `state.json` by hand.** The workflow commits it.
- **UI: don't store the PAT anywhere except `localStorage`.** No cookies, no URL params, no analytics.
- **UI: don't drift toward generic dashboard aesthetic.** The mockup is canonical.
