// Adapter tests for ebgames-ca. We mock politeFetch so these run offline.
// Covers the four failure modes the adapter must guarantee:
//   - happy path (in-stock / out-of-stock)
//   - missing Product block → throws
//   - unexpected availability value → throws
//   - Product block without price → returns confidence: 'low'

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/fetch.js', () => ({
  politeFetch: vi.fn(),
}));

import { politeFetch } from '../lib/fetch.js';
import ebgamesCa from './ebgames-ca.js';

const WATCH = {
  id: 'test-etb',
  name: 'Pokémon TCG: Prismatic Evolutions ETB',
  retailer: 'ebgames_ca',
  url: 'https://www.ebgames.ca/pokemon-tcg/pokemon-tcg-prismatic-evolutions-elite-trainer-box/872627.html',
};

/** Build an HTML fixture with one Product JSON-LD block. */
function htmlWithProduct(product) {
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [],
    })}</script>
    <script type="application/ld+json">${JSON.stringify(product)}</script>
  </head><body>...</body></html>`;
}

function okResponse(html) {
  return { ok: true, status: 200, text: async () => html };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ebgames-ca adapter', () => {
  it('parses in-stock Product JSON-LD with price → high confidence', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        htmlWithProduct({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Pokémon TCG: Prismatic Evolutions ETB',
          offers: {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            price: '79.99',
            priceCurrency: 'CAD',
          },
        })
      )
    );

    const result = await ebgamesCa.check(WATCH);
    expect(result.inStock).toBe(true);
    expect(result.price).toBe(79.99);
    expect(result.confidence).toBe('high');
    expect(result.retailer).toBe('ebgames_ca');
    expect(result.watchId).toBe(WATCH.id);
    expect(result.url).toBe(WATCH.url);
  });

  it('parses out-of-stock Product JSON-LD', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        htmlWithProduct({
          '@type': 'Product',
          offers: {
            availability: 'https://schema.org/OutOfStock',
            price: '79.99',
          },
        })
      )
    );

    const result = await ebgamesCa.check(WATCH);
    expect(result.inStock).toBe(false);
    expect(result.price).toBe(79.99);
    expect(result.confidence).toBe('high');
  });

  it('throws when no Product JSON-LD block exists', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        `<!doctype html><html><head>
          <script type="application/ld+json">${JSON.stringify({
            '@type': 'BreadcrumbList',
            itemListElement: [],
          })}</script>
        </head></html>`
      )
    );

    await expect(ebgamesCa.check(WATCH)).rejects.toThrow(/no Product JSON-LD/);
  });

  it('throws on unexpected availability (e.g. PreOrder)', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        htmlWithProduct({
          '@type': 'Product',
          offers: {
            availability: 'https://schema.org/PreOrder',
            price: '79.99',
          },
        })
      )
    );

    await expect(ebgamesCa.check(WATCH)).rejects.toThrow(/unexpected availability/);
  });

  it('returns confidence: low when price is missing', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        htmlWithProduct({
          '@type': 'Product',
          offers: {
            availability: 'https://schema.org/InStock',
            // no price field
          },
        })
      )
    );

    const result = await ebgamesCa.check(WATCH);
    expect(result.inStock).toBe(true);
    expect(result.price).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('finds Product nested inside @graph', async () => {
    politeFetch.mockResolvedValueOnce(
      okResponse(
        `<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'WebPage', url: 'x' },
            {
              '@type': 'Product',
              offers: {
                availability: 'https://schema.org/InStock',
                price: 64.99,
              },
            },
          ],
        })}</script>`
      )
    );

    const result = await ebgamesCa.check(WATCH);
    expect(result.inStock).toBe(true);
    expect(result.price).toBe(64.99);
  });

  it('throws on non-ok HTTP responses', async () => {
    politeFetch.mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' });
    await expect(ebgamesCa.check(WATCH)).rejects.toThrow(/HTTP 503/);
  });

  it('throws when watch has no url', async () => {
    await expect(ebgamesCa.check({ id: 'x', name: 'y', retailer: 'ebgames_ca' })).rejects.toThrow(
      /has no url/
    );
  });
});
