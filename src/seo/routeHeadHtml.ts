/**
 * Bakes {@link RouteMeta} into a built HTML document.
 *
 * Used by `scripts/seo/prerender-routes.ts` to turn one `dist/index.html` into a
 * real page per route. Kept as string surgery on the shipped document — rather
 * than a second template — so the pre-rendered pages keep every preload, font
 * face and script tag Vite emitted, byte for byte, and can only differ in the
 * head fields listed here.
 *
 * Every rewrite is mandatory: a missing tag throws so an edit to `index.html`
 * fails the build instead of quietly shipping 71 pages with a stale card.
 */
import { canonicalUrl, type RouteMeta } from './routeMeta';

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches `attr="value"`, `attr='value'` and the unquoted `attr=value`. */
function attributeSource(attr: string, value: string): string {
  const v = escapeRegExp(value);
  return `${attr}\\s*=\\s*(?:"${v}"|'${v}'|${v}(?=[\\s/>]))`;
}

const CONTENT_VALUE = /(content\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i;
const HREF_VALUE = /(href\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i;

/**
 * Replaces one attribute value inside the single tag selected by `tagSource`.
 *
 * @param label Human-readable tag name for the error message.
 */
function setTagAttribute(
  html: string,
  tagSource: RegExp,
  valuePattern: RegExp,
  label: string,
  value: string,
): string {
  const tag = tagSource.exec(html);
  if (!tag) throw new Error(`prerender: no ${label} tag found to rewrite`);
  if (!valuePattern.test(tag[0])) {
    throw new Error(`prerender: ${label} tag has no value to rewrite`);
  }

  const rewritten = tag[0].replace(
    valuePattern,
    (_whole, prefix: string) => `${prefix}"${escapeAttribute(value)}"`,
  );

  return html.replace(tag[0], () => rewritten);
}

function setMetaContent(
  html: string,
  attr: 'name' | 'property',
  name: string,
  value: string,
): string {
  return setTagAttribute(
    html,
    new RegExp(`<meta\\b[^>]*${attributeSource(attr, name)}[^>]*>`, 'i'),
    CONTENT_VALUE,
    `<meta ${attr}="${name}">`,
    value,
  );
}

export function applyRouteMetaToHtml(html: string, meta: RouteMeta): string {
  const url = canonicalUrl(meta.canonicalPath);

  let out = html;
  out = setTagAttribute(
    out,
    new RegExp(
      `<link\\b[^>]*${attributeSource('rel', 'canonical')}[^>]*>`,
      'i',
    ),
    HREF_VALUE,
    '<link rel="canonical">',
    url,
  );
  out = setMetaContent(out, 'name', 'description', meta.description);
  out = setMetaContent(out, 'property', 'og:url', url);
  out = setMetaContent(out, 'property', 'og:title', meta.title);
  out = setMetaContent(out, 'property', 'og:description', meta.description);
  out = setMetaContent(out, 'name', 'twitter:url', url);
  out = setMetaContent(out, 'name', 'twitter:title', meta.title);
  out = setMetaContent(out, 'name', 'twitter:description', meta.description);

  const titleTag = /<title>[\s\S]*?<\/title>/i;
  if (!titleTag.test(out)) {
    throw new Error('prerender: no <title> tag found to rewrite');
  }
  out = out.replace(titleTag, () => `<title>${escapeText(meta.title)}</title>`);

  return out;
}
