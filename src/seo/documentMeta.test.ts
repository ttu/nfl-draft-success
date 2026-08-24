import { describe, it, expect, beforeEach } from 'vitest';
import { applyRouteMetaToDocument } from './documentMeta';
import type { RouteMeta } from './routeMeta';

const meta: RouteMeta = {
  title: 'Tampa Bay Buccaneers Draft Results | NFL Draft Success',
  description: 'How the Buccaneers have drafted.',
  canonicalPath: '/TB',
};

const URL_TB = 'https://www.nfldraftsuccess.com/TB';

function content(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('applyRouteMetaToDocument', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="Old" />
      <link rel="canonical" href="https://www.nfldraftsuccess.com/" />
      <meta property="og:url" content="https://www.nfldraftsuccess.com/" />
      <meta property="og:title" content="NFL Draft Success" />
      <meta property="og:description" content="Old" />
      <meta name="twitter:url" content="https://www.nfldraftsuccess.com/" />
      <meta name="twitter:title" content="NFL Draft Success" />
      <meta name="twitter:description" content="Old" />
    `;
    document.title = 'NFL Draft Success';
  });

  it('sets the document title', () => {
    applyRouteMetaToDocument(meta);
    expect(document.title).toBe(meta.title);
  });

  it('repoints the canonical link at the route, without its query string', () => {
    applyRouteMetaToDocument(meta);
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe(URL_TB);
  });

  it('repoints the Open Graph and Twitter tags', () => {
    applyRouteMetaToDocument(meta);
    expect(content('meta[property="og:url"]')).toBe(URL_TB);
    expect(content('meta[name="twitter:url"]')).toBe(URL_TB);
    expect(content('meta[property="og:title"]')).toBe(meta.title);
    expect(content('meta[name="twitter:title"]')).toBe(meta.title);
    expect(content('meta[property="og:description"]')).toBe(meta.description);
    expect(content('meta[name="twitter:description"]')).toBe(meta.description);
    expect(content('meta[name="description"]')).toBe(meta.description);
  });

  it('creates any tag the document is missing', () => {
    document.head.innerHTML = '';
    applyRouteMetaToDocument(meta);
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href'),
    ).toBe(URL_TB);
    expect(content('meta[property="og:url"]')).toBe(URL_TB);
  });

  it('does not duplicate tags when applied repeatedly', () => {
    applyRouteMetaToDocument(meta);
    applyRouteMetaToDocument({ ...meta, title: 'Second' });
    expect(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('meta[property="og:title"]'),
    ).toHaveLength(1);
    expect(document.title).toBe('Second');
  });
});
