import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROUTE_META,
  SITE_ORIGIN,
  canonicalUrl,
  resolveRouteMeta,
} from './routeMeta';

describe('resolveRouteMeta', () => {
  it('returns the site defaults for the landing route', () => {
    expect(resolveRouteMeta('/')).toEqual(DEFAULT_ROUTE_META);
  });

  it('names the team on a team route', () => {
    const meta = resolveRouteMeta('/TB');
    expect(meta.title).toBe(
      'Tampa Bay Buccaneers Draft Results | NFL Draft Success',
    );
    expect(meta.description).toContain('Tampa Bay Buccaneers');
    expect(meta.canonicalPath).toBe('/TB');
  });

  it('ignores a trailing slash so the directory form canonicalises to the same URL', () => {
    expect(resolveRouteMeta('/TB/')).toEqual(resolveRouteMeta('/TB'));
  });

  it('names the class on a draft-year route', () => {
    const meta = resolveRouteMeta('/year/2025');
    expect(meta.title).toBe('2025 NFL Draft Class Results | NFL Draft Success');
    expect(meta.description).toContain('2025');
    expect(meta.canonicalPath).toBe('/year/2025');
  });

  it('falls back to the defaults for a year outside the published bounds', () => {
    expect(resolveRouteMeta('/year/1999')).toEqual(DEFAULT_ROUTE_META);
    expect(resolveRouteMeta('/year/notayear')).toEqual(DEFAULT_ROUTE_META);
  });

  it('names the position on a position route', () => {
    const meta = resolveRouteMeta('/position/QB');
    expect(meta.title).toBe('QB Draft Picks by Year | NFL Draft Success');
    expect(meta.description).toContain('QB');
    expect(meta.canonicalPath).toBe('/position/QB');
  });

  it('canonicalises position aliases and casing to one URL', () => {
    const meta = resolveRouteMeta('/position/t');
    expect(meta.title).toBe('OT Draft Picks by Year | NFL Draft Success');
    expect(meta.canonicalPath).toBe('/position/OT');
  });

  it('decodes an encoded position segment', () => {
    expect(resolveRouteMeta('/position/%51%42').canonicalPath).toBe(
      '/position/QB',
    );
  });

  it('describes the highlights route', () => {
    const meta = resolveRouteMeta('/highlights');
    expect(meta.title).toBe('Draft Steals & Busts | NFL Draft Success');
    expect(meta.canonicalPath).toBe('/highlights');
  });

  it('names the player when one has loaded, and stays generic before that', () => {
    expect(resolveRouteMeta('/player/00-0036212').title).toBe(
      'Player Draft Profile | NFL Draft Success',
    );
    const named = resolveRouteMeta('/player/00-0036212', {
      playerName: 'Tristan Wirfs',
    });
    expect(named.title).toBe('Tristan Wirfs Draft Profile | NFL Draft Success');
    expect(named.description).toContain('Tristan Wirfs');
    expect(named.canonicalPath).toBe('/player/00-0036212');
  });

  it('falls back to the defaults for an unknown route', () => {
    expect(resolveRouteMeta('/NOTATEAM')).toEqual(DEFAULT_ROUTE_META);
    expect(resolveRouteMeta('/some/deep/path')).toEqual(DEFAULT_ROUTE_META);
  });

  it('drops any query string or hash from the canonical path', () => {
    expect(resolveRouteMeta('/TB?from=2021&to=2025#roster').canonicalPath).toBe(
      '/TB',
    );
  });
});

describe('canonicalUrl', () => {
  it('joins the canonical path onto the production origin', () => {
    expect(canonicalUrl('/TB')).toBe(`${SITE_ORIGIN}/TB`);
    expect(canonicalUrl('/')).toBe(`${SITE_ORIGIN}/`);
  });
});
