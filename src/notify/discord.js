// Discord restock notification via incoming webhook.
// Why a rich embed: the phone push preview actually shows the title + field
// values, so the price and retailer are visible without opening the app.

import { politeFetch } from '../lib/fetch.js';
import { logger } from '../lib/logger.js';
import { RETAILERS } from '../../shared/schema.js';

const COLOUR_MINT = 0x7dffb4; // In-stock — matches the UI's --accent-mint.
const COLOUR_AMBER = 0xffb347; // Low-confidence warning.

/**
 * Send a single restock embed to the configured webhook.
 * Resolves on success, throws on failure (caller decides whether to swallow).
 *
 * @param {import('../../shared/schema.js').WatchResult} result
 */
export async function sendDiscord(result) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    throw new Error('DISCORD_WEBHOOK_URL is not set');
  }

  const retailerLabel = RETAILERS[result.retailer]?.label ?? result.retailer;
  const priceText = result.price != null ? `$${result.price.toFixed(2)} CAD` : 'Price unknown';
  const lowConf = result.confidence === 'low';
  const titlePrefix = lowConf ? '⚠️ ' : '';

  const body = {
    // No @here/@everyone — this is a personal channel. Keep the ping quiet.
    content: `${titlePrefix}**${result.name}** is in stock at ${retailerLabel}`,
    embeds: [
      {
        title: result.name,
        url: result.url,
        color: lowConf ? COLOUR_AMBER : COLOUR_MINT,
        fields: [
          { name: 'Retailer', value: retailerLabel, inline: true },
          { name: 'Price', value: priceText, inline: true },
          { name: 'Confidence', value: result.confidence, inline: true },
        ],
        timestamp: result.checkedAt,
        footer: { text: 'PackWatch' },
      },
    ],
  };

  const res = await politeFetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord webhook HTTP ${res.status}: ${text}`);
  }
  logger.info(`discord notified — ${result.name}`);
}
