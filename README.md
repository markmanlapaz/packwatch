# PackWatch

A personal Pokémon TCG restock watcher. Every 5 minutes a GitHub Actions cron
checks Best Buy Canada and EB Games Canada for the products on your
watchlist. When something flips from out-of-stock to in-stock (and is under
your max price) you get a Discord ping and an email with a one-tap link to
the product page.

> **Single-user tool.** No accounts, no billing, no public-facing anything.
> It's a script, a JSON file, and a cron trigger. That's the whole design.

## Monorepo layout

```
packwatch/
├── .github/workflows/check-stock.yml   # Cron, every 5 min
├── config/watchlist.json               # Your watches (hand-edit or UI-written)
├── shared/schema.js                    # Shapes + retailer registry (used by both sides)
├── src/                                # The watcher
│   ├── index.js                        # Core loop
│   ├── state.js                        # Reads/writes state.json
│   ├── lib/                            # fetch + logger
│   ├── adapters/                       # One file per retailer
│   └── notify/                         # discord + email
├── state.json                          # Last known stock state (committed by CI)
├── web/                                # PWA for managing the watchlist (NOT built yet)
├── package.json                        # Watcher deps only
└── README.md
```

Two roots keep the cron fast: the Actions runner installs only `resend`, not
the React/Vite world under `web/`.

## Watcher setup

You'll need three accounts and one repo:

1. **This repo**, cloned locally.
2. **Discord**, with a webhook on a channel you control.
3. **Resend** (https://resend.com), with a verified sending domain.

### 1. Discord webhook

In Discord: *Server Settings → Integrations → Webhooks → New Webhook*.
Copy the URL — it looks like `https://discord.com/api/webhooks/...`.

### 2. Resend

Create an account, verify a domain you own, and create an API key.
You also need a sender address on that domain (e.g. `packwatch@yourdomain.com`).

### 3. GitHub Secrets

Set these on the repo under *Settings → Secrets and variables → Actions*:

| Secret name            | Value                                  |
|------------------------|----------------------------------------|
| `DISCORD_WEBHOOK_URL`  | Webhook from step 1                    |
| `RESEND_API_KEY`       | API key from step 2                    |
| `NOTIFY_EMAIL`         | Where restock emails should land       |
| `RESEND_FROM_EMAIL`    | Verified sender on your Resend domain  |

That's it — the cron will start firing on the next 5-minute boundary after
you push to `main`. Confirm it's alive via the *Actions* tab.

## Adding a watch (manual edit)

Edit `config/watchlist.json` directly and push. The shape depends on the
retailer — Best Buy watches carry a `sku`, EB Games watches carry a `url`:

```json
{
  "watches": [
    {
      "id": "151-etb",
      "name": "Pokémon TCG: 151 Elite Trainer Box",
      "retailer": "bestbuy_ca",
      "sku": "17890123",
      "maxPrice": 79.99,
      "enabled": true
    },
    {
      "id": "pe-etb-ebgames",
      "name": "Pokémon TCG: Prismatic Evolutions ETB",
      "retailer": "ebgames_ca",
      "url": "https://www.ebgames.ca/pokemon-tcg/pokemon-tcg-prismatic-evolutions-elite-trainer-box/872627.html",
      "maxPrice": 79.99,
      "enabled": true
    }
  ]
}
```

- `id` is a stable slug. Changing it resets stock history for that watch —
  useful if you want to force a fresh "first-ever in-stock" notification.
- `enabled: false` pauses the watch without deleting it.
- `maxPrice` is optional. If set and the current price is above it, no
  notification fires even on a restock.
- `bestbuy_ca` watches require `sku` (the numeric tail of the product URL).
- `ebgames_ca` watches require the full product `url` — the adapter fetches
  the page and reads stock and price from the JSON-LD block. A bare SKU
  isn't enough to reconstruct the URL.

> A mobile PWA for managing the watchlist from your phone lives under `web/`
> and will be built in a separate session. Until then, `watchlist.json` is
> the source of truth — edit it and push.

### Finding a Best Buy CA SKU

The SKU is the numeric string at the end of a product URL.

```
https://www.bestbuy.ca/en-ca/product/pokemon-trading-card-game-scarlet-violet-151-elite-trainer-box/17890123
                                                                                                    ^^^^^^^^
```

Copy that number into the `sku` field. That's all the retailer needs — the
availability endpoint is keyed by SKU.

### Finding an EB Games CA product URL

EB Games doesn't expose a public JSON API, so the adapter fetches the
product page directly and reads stock and price from the `<script type="application/ld+json">`
block the site ships for SEO. Paste the full URL into the `url` field:

```
https://www.ebgames.ca/pokemon-tcg/pokemon-tcg-prismatic-evolutions-elite-trainer-box/872627.html
```

The UI can't auto-fetch the product name and current price for EB Games yet.
Browsers block cross-origin requests to `ebgames.ca`, and the JSON-LD block
is only on the server-rendered HTML. You'll type the name (and optional max
price) manually when adding the watch. The watcher still reads stock and
price server-side — only the add/edit preview is manual.

> **Phase 3 note.** Auto-fetch for EB Games (and Walmart, when added) will
> be introduced via a Cloudflare Worker proxy that fronts the retailer HTML
> and strips CORS. Deferred until a second retailer actually needs it.

## Local development

```bash
npm install
cp .env.example .env   # Fill in DISCORD_WEBHOOK_URL, RESEND_API_KEY, NOTIFY_EMAIL, RESEND_FROM_EMAIL
DRY_RUN=true npm start
```

With `DRY_RUN=true`:

- Adapters still hit the real APIs (so you can confirm your SKU parses).
- No Discord or email goes out.
- `state.json` is **not** written — safe to run over and over.

For verbose output: `LOG_LEVEL=debug DRY_RUN=true npm start`.

## Troubleshooting

**"I pushed but no cron run appeared."**
Check the *Actions* tab. New repos need the workflow enabled once. Also, GitHub
deprioritises schedules on very quiet repos — if nothing has happened for weeks,
the cron can silently stall. A single `workflow_dispatch` run (or any push)
wakes it back up.

**"I got nothing when I know the item restocked."**
Open the most recent Actions run and look for a line like
`check failed — bestbuy_ca/<id>: ...`. Best Buy occasionally reshapes their
availability payload; the adapter throws on parse failure (on purpose, to avoid
false positives) and logs the error. Fix `src/adapters/bestbuy-ca.js` to match
the new shape and push.

**"Notifications fired twice."**
Shouldn't happen — state diffing makes the run idempotent. If you see it, check
whether `state.json` was reset (e.g. a bad hand-edit merged). The next clean
run will rebuild state and stop the double-fire.

**"Email silently fails."**
Usually one of:
- `RESEND_FROM_EMAIL` is not on a verified Resend domain.
- `NOTIFY_EMAIL` bounced and Resend suppressed further delivery.
Logs will show `resend error: ...` — check them in the Actions run.

**"Discord silently fails."**
Webhook revoked or channel deleted. Regenerate and update the secret.

## What's not in this repo (yet)

- A Cloudflare Worker proxy to unlock browser-side auto-fetch for retailers
  without CORS-friendly APIs (EB Games, Walmart when added).
- Adapters for retailers beyond Best Buy CA and EB Games CA. Walmart,
  Costco, and Amazon are the obvious next candidates but not in scope yet.
- Price history, charts, or heartbeat "still OOS" summaries. Silent-by-default
  is a feature, not an oversight.
