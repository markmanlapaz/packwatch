// Retailer registry tests — focus on the dependency-free URL parsers the UI
// uses when validating/saving a watch. Keeping them under web/ because that's
// where the existing vitest harness lives.

import { describe, it, expect } from 'vitest';
import { RETAILERS } from '../../../shared/schema.js';

const eb = RETAILERS.ebgames_ca;
const bb = RETAILERS.bestbuy_ca;

describe('ebgames_ca.skuFromUrl', () => {
  it('extracts SKU from a canonical product URL', () => {
    expect(
      eb.skuFromUrl(
        'https://www.ebgames.ca/pokemon-tcg/pokemon-tcg-prismatic-evolutions-elite-trainer-box/872627.html'
      )
    ).toBe('872627');
  });

  it('extracts SKU when the URL has a query string', () => {
    expect(
      eb.skuFromUrl('https://www.ebgames.ca/category/slug/123456.html?utm_source=share')
    ).toBe('123456');
  });

  it('extracts SKU when the URL has a hash fragment', () => {
    expect(eb.skuFromUrl('https://www.ebgames.ca/a/b/999999.html#reviews')).toBe('999999');
  });

  it('returns null when the URL has no .html suffix', () => {
    expect(eb.skuFromUrl('https://www.ebgames.ca/pokemon-tcg/some-product/872627')).toBeNull();
  });

  it('returns null for a malformed / unrelated URL', () => {
    expect(eb.skuFromUrl('https://example.com/nothing-here')).toBeNull();
    expect(eb.skuFromUrl('not a url')).toBeNull();
    expect(eb.skuFromUrl('')).toBeNull();
    expect(eb.skuFromUrl(null)).toBeNull();
    expect(eb.skuFromUrl(undefined)).toBeNull();
  });

  it('validates via urlPattern', () => {
    expect(
      eb.urlPattern.test(
        'https://www.ebgames.ca/pokemon-tcg/some-slug/872627.html'
      )
    ).toBe(true);
    expect(eb.urlPattern.test('https://www.bestbuy.ca/en-ca/product/x/17890123')).toBe(false);
  });
});

describe('bestbuy_ca.skuFromUrl', () => {
  it('extracts SKU from a canonical Best Buy CA URL', () => {
    expect(
      bb.skuFromUrl(
        'https://www.bestbuy.ca/en-ca/product/pokemon-tcg-scarlet-violet-151/17890123'
      )
    ).toBe('17890123');
  });

  it('returns null for a non-Best-Buy URL', () => {
    // Note: bestbuy_ca.skuFromUrl is permissive — it just looks for any trailing 6+ digit
    // id. That matches Phase 1 behaviour (`web/src/lib/bestbuy.js#extractSku`). Full
    // domain validation lives in the UI's fetch step.
    expect(bb.skuFromUrl('https://example.com/no/digits/here')).toBeNull();
  });
});

describe('retailer flags', () => {
  it('Best Buy supports auto-fetch, EB Games does not', () => {
    expect(bb.supportsAutoFetch).toBe(true);
    expect(eb.supportsAutoFetch).toBe(false);
  });

  it('exposes the expected identifier field per retailer', () => {
    expect(bb.watchField).toBe('sku');
    expect(eb.watchField).toBe('url');
  });
});
