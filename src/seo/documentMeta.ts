/**
 * Keeps the live document head in step with the route.
 *
 * The pre-rendered HTML (see `scripts/seo/prerender-routes.ts`) is only correct for
 * the URL the browser first requested; every client-side navigation after that
 * would otherwise leave the previous page's title, canonical and share card in
 * place. Same {@link RouteMeta} source, applied to the DOM instead of a string.
 */
import { canonicalUrl, type RouteMeta } from './routeMeta';

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  value: string,
): void {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function upsertCanonical(url: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', url);
}

export function applyRouteMetaToDocument(meta: RouteMeta): void {
  const url = canonicalUrl(meta.canonicalPath);

  document.title = meta.title;
  upsertCanonical(url);
  upsertMeta('name', 'description', meta.description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('name', 'twitter:url', url);
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);
}
