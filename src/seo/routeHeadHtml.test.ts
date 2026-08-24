import { describe, it, expect } from 'vitest';
import { applyRouteMetaToHtml } from './routeHeadHtml';
import type { RouteMeta } from './routeMeta';

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta
      name="description"
      content="Old description"
    />
    <link rel="canonical" href="https://www.nfldraftsuccess.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.nfldraftsuccess.com/" />
    <meta property="og:title" content="NFL Draft Success" />
    <meta property="og:description" content="Old description" />
    <meta property="og:image" content="https://www.nfldraftsuccess.com/og-image.png?v=2" />
    <meta name="twitter:url" content="https://www.nfldraftsuccess.com/" />
    <meta name="twitter:title" content="NFL Draft Success" />
    <meta name="twitter:description" content="Old description" />
    <title>NFL Draft Success</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

const meta: RouteMeta = {
  title: 'Tampa Bay Buccaneers Draft Results | NFL Draft Success',
  description: 'How the Buccaneers have drafted.',
  canonicalPath: '/TB',
};

describe('applyRouteMetaToHtml', () => {
  const out = applyRouteMetaToHtml(HTML, meta);

  it('rewrites the document title', () => {
    expect(out).toContain(`<title>${meta.title}</title>`);
    expect(out).not.toContain('<title>NFL Draft Success</title>');
  });

  it('points the canonical link at the route', () => {
    expect(out).toContain(
      '<link rel="canonical" href="https://www.nfldraftsuccess.com/TB" />',
    );
  });

  it('rewrites the description in all three places', () => {
    expect(out).not.toContain('Old description');
    expect(out.match(/How the Buccaneers have drafted\./g)).toHaveLength(3);
  });

  it('rewrites the Open Graph and Twitter URLs and titles', () => {
    for (const attr of ['property="og:url"', 'name="twitter:url"']) {
      expect(out).toContain(
        `<meta ${attr} content="https://www.nfldraftsuccess.com/TB" />`,
      );
    }
    for (const attr of ['property="og:title"', 'name="twitter:title"']) {
      expect(out).toContain(`<meta ${attr} content="${meta.title}" />`);
    }
  });

  it('leaves the shared card image and everything below the head alone', () => {
    expect(out).toContain(
      '<meta property="og:image" content="https://www.nfldraftsuccess.com/og-image.png?v=2" />',
    );
    expect(out).toContain('<meta property="og:type" content="website" />');
    expect(out).toContain('<body><div id="root"></div></body>');
  });

  it('escapes markup-significant characters in the values it writes', () => {
    const escaped = applyRouteMetaToHtml(HTML, {
      title: 'Steals & "Busts" <hr>',
      description: 'A & B',
      canonicalPath: '/highlights',
    });
    expect(escaped).toContain('<title>Steals &amp; "Busts" &lt;hr&gt;</title>');
    expect(escaped).toContain(
      '<meta property="og:title" content="Steals &amp; &quot;Busts&quot; &lt;hr&gt;" />',
    );
  });

  it('throws when a tag it must rewrite is missing, rather than shipping a stale head', () => {
    expect(() =>
      applyRouteMetaToHtml(
        HTML.replace(/<link rel="canonical"[^>]*>/, ''),
        meta,
      ),
    ).toThrow(/canonical/i);
    expect(() =>
      applyRouteMetaToHtml(HTML.replace(/<title>[^<]*<\/title>/, ''), meta),
    ).toThrow(/title/i);
  });

  it('is idempotent, so re-applying identical values is not mistaken for a missing tag', () => {
    const once = applyRouteMetaToHtml(HTML, meta);
    expect(() => applyRouteMetaToHtml(once, meta)).not.toThrow();
    expect(applyRouteMetaToHtml(once, meta)).toBe(once);
  });

  it('throws when a tag it must rewrite has no value attribute', () => {
    expect(() =>
      applyRouteMetaToHtml(
        HTML.replace(
          '<meta property="og:url" content="https://www.nfldraftsuccess.com/" />',
          '<meta property="og:url" />',
        ),
        meta,
      ),
    ).toThrow(/og:url/);
  });

  it('handles the collapsed markup a bundler may emit', () => {
    const collapsed = applyRouteMetaToHtml(
      '<head><meta name=description content="Old description"><link rel=canonical href="https://www.nfldraftsuccess.com/"><meta property=og:url content="https://www.nfldraftsuccess.com/"><meta property=og:title content="x"><meta property=og:description content="x"><meta name=twitter:url content="x"><meta name=twitter:title content="x"><meta name=twitter:description content="x"><title>x</title></head>',
      meta,
    );
    expect(collapsed).toContain('content="https://www.nfldraftsuccess.com/TB"');
    expect(collapsed).toContain(`<title>${meta.title}</title>`);
    expect(collapsed).not.toContain('Old description');
  });
});
