import { describe, it, expect } from 'vitest';
import normalizeProductName from './normalizeProductName.js';

describe('normalizeProductName', () => {
  it('title-cases and fixes Pokémon accent + TCG + ETB', () => {
    expect(normalizeProductName('pokemon tcg scarlet & violet 151 etb')).toBe(
      'Pokémon TCG Scarlet & Violet 151 ETB'
    );
  });

  it('normalizes mixed-case Best Buy output ("Pokemon Tcg")', () => {
    expect(normalizeProductName('Pokemon Tcg: Twilight Masquerade Elite Trainer Box')).toBe(
      'Pokémon TCG: Twilight Masquerade Elite Trainer Box'
    );
  });

  it('preserves already-accented Pokémon and is idempotent', () => {
    const once = normalizeProductName('Pokémon TCG: Charizard ex Box');
    expect(once).toBe('Pokémon TCG: Charizard EX Box');
    expect(normalizeProductName(once)).toBe(once);
  });

  it('keeps acronyms like VMAX, VSTAR, SV in caps', () => {
    expect(normalizeProductName('charizard vmax premium collection')).toBe(
      'Charizard VMAX Premium Collection'
    );
    expect(normalizeProductName('arceus vstar sv xy etb')).toBe(
      'Arceus VSTAR SV XY ETB'
    );
  });

  it('does not mutate numbers or product codes', () => {
    expect(normalizeProductName('scarlet & violet 151 etb')).toBe(
      'Scarlet & Violet 151 ETB'
    );
  });

  it('preserves special characters (& : - —)', () => {
    expect(normalizeProductName('pokemon — paldea evolved: booster bundle')).toBe(
      'Pokémon — Paldea Evolved: Booster Bundle'
    );
    expect(normalizeProductName('scarlet-violet 151')).toBe('Scarlet-Violet 151');
  });

  it('handles uppercase input', () => {
    expect(normalizeProductName('POKEMON TCG SV ETB')).toBe('Pokémon TCG SV ETB');
  });

  it('returns empty string for null / undefined / empty input', () => {
    expect(normalizeProductName(null)).toBe('');
    expect(normalizeProductName(undefined)).toBe('');
    expect(normalizeProductName('')).toBe('');
    expect(normalizeProductName('   ')).toBe('');
  });
});
