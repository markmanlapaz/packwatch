/**
 * Normalize a raw product name from Best Buy into a consistent Title Case form,
 * while preserving TCG acronyms (TCG, ETB, VMAX, etc.) in ALL CAPS and forcing
 * "Pokemon" → "Pokémon".
 *
 * Pure function. Never mutates numbers or non-letter characters.
 */

const ACRONYMS = new Set([
  'TCG',
  'ETB',
  'EX',
  'GX',
  'V',
  'VMAX',
  'VSTAR',
  'MEGA',
  'SV',
  'XY',
]);

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function normalizeProductName(raw) {
  if (raw == null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  return str.replace(/\p{L}+/gu, (word) => {
    const plainUpper = stripAccents(word).toUpperCase();
    if (plainUpper === 'POKEMON') return 'Pokémon';
    if (ACRONYMS.has(plainUpper)) return plainUpper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
