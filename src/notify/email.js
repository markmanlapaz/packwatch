// Restock email via Resend.
// Why HTML with a big CTA: on mobile the email is fired open from a lock-screen
// notification, and a fat tap-target to the product page is the only thing that
// matters. Keep styles inline — some clients strip <style> blocks.

import { Resend } from 'resend';
import { logger } from '../lib/logger.js';
import { RETAILERS } from '../../shared/schema.js';

/**
 * @param {import('../../shared/schema.js').WatchResult} result
 */
export async function sendEmail(result) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  if (!to) throw new Error('NOTIFY_EMAIL is not set');
  if (!from) throw new Error('RESEND_FROM_EMAIL is not set');

  const resend = new Resend(apiKey);
  const retailerLabel = RETAILERS[result.retailer]?.label ?? result.retailer;
  const priceText = result.price != null ? `$${result.price.toFixed(2)} CAD` : 'Price unknown';
  const lowConf = result.confidence === 'low';
  const subjectPrefix = lowConf ? '[⚠️ low-confidence] ' : '';

  const subject = `${subjectPrefix}In stock: ${result.name} (${retailerLabel})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a0514; color:#e8f6ff; padding:32px 24px; max-width:560px; margin:0 auto;">
      <p style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#9ea8c7; margin:0 0 8px;">PackWatch${lowConf ? ' · low confidence' : ''}</p>
      <h1 style="font-size:26px; line-height:1.25; margin:0 0 16px; color:#e8f6ff;">${escapeHtml(result.name)}</h1>
      <p style="font-size:15px; color:#9ea8c7; margin:0 0 24px;">
        ${escapeHtml(retailerLabel)} &middot; <strong style="color:#7dffb4;">${escapeHtml(priceText)}</strong>
      </p>
      <a href="${escapeAttr(result.url)}"
         style="display:inline-block; background:#35f0e5; color:#0a0514; font-weight:600; font-size:15px; padding:14px 28px; border-radius:6px; text-decoration:none; letter-spacing:0.02em;">
        Buy now →
      </a>
      <p style="font-size:12px; color:#5a6286; margin:32px 0 0;">
        Checked ${escapeHtml(result.checkedAt)}.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`resend error: ${error.message || JSON.stringify(error)}`);
  }
  logger.info(`email sent — ${result.name}`);
}

// Minimal HTML escaper. The fields we inject (name, retailer, price) are from
// our own config + API responses, but belt-and-braces costs nothing.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}
