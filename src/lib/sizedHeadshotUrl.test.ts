import { describe, it, expect } from 'vitest';
import { HEADSHOT_WIDTH_BUCKETS, sizedHeadshotUrl } from './sizedHeadshotUrl';

const UPLOAD =
  'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/skoecv9k14idjai4ok42';
const PRIVATE =
  'https://static.www.nfl.com/image/private/f_auto,q_auto/league/skoecv9k14idjai4ok42';

describe('sizedHeadshotUrl', () => {
  it('asks the CDN for a sized crop instead of the full-resolution original', () => {
    expect(sizedHeadshotUrl(UPLOAD, 44)).toBe(
      'https://static.www.nfl.com/image/upload/f_auto,q_auto,w_96,h_96,c_fill,g_face/league/skoecv9k14idjai4ok42',
    );
  });

  it('sizes the private delivery path too', () => {
    expect(sizedHeadshotUrl(PRIVATE, 44)).toBe(
      'https://static.www.nfl.com/image/private/f_auto,q_auto,w_96,h_96,c_fill,g_face/league/skoecv9k14idjai4ok42',
    );
  });

  it('keeps the existing transformation flags rather than replacing them', () => {
    // `f_auto,q_auto` is what makes the CDN serve WebP at a sane quality.
    expect(sizedHeadshotUrl(UPLOAD, 44)).toContain('f_auto,q_auto,');
  });

  it('requests two device pixels per CSS pixel so the crop stays sharp on retina', () => {
    // 32 CSS px wants 64 real px, which is already a bucket — no rounding up.
    expect(sizedHeadshotUrl(UPLOAD, 32)).toContain('w_64,h_64');
  });

  it('snaps up to a shared bucket so every call site hits one warm CDN entry', () => {
    // 28 and 32 both land on 64: three list views share one cached derivative.
    expect(sizedHeadshotUrl(UPLOAD, 28)).toContain('w_64,h_64');
    expect(sizedHeadshotUrl(UPLOAD, 32)).toContain('w_64,h_64');
    // 36 and 44 both land on 96.
    expect(sizedHeadshotUrl(UPLOAD, 36)).toContain('w_96,h_96');
    expect(sizedHeadshotUrl(UPLOAD, 44)).toContain('w_96,h_96');
  });

  it('never asks for fewer pixels than the avatar will paint', () => {
    for (const size of [28, 32, 36, 44, 104]) {
      const width = Number(
        /w_(\d+)/.exec(sizedHeadshotUrl(UPLOAD, size) ?? '')?.[1],
      );
      expect(width).toBeGreaterThanOrEqual(size * 2);
    }
  });

  it('serves the largest bucket to avatars bigger than any bucket', () => {
    const largest = HEADSHOT_WIDTH_BUCKETS[HEADSHOT_WIDTH_BUCKETS.length - 1];
    expect(sizedHeadshotUrl(UPLOAD, 4000)).toContain(
      `w_${largest},h_${largest}`,
    );
  });

  it('leaves a URL that already carries a width alone', () => {
    // Re-sizing an already-sized URL would stack transforms and miss the cache.
    const sized = sizedHeadshotUrl(UPLOAD, 44) as string;
    expect(sizedHeadshotUrl(sized, 104)).toBe(sized);
  });

  it('passes through hosts it does not know how to resize', () => {
    const other = 'https://example.com/headshots/player.png';
    expect(sizedHeadshotUrl(other, 44)).toBe(other);
  });

  it('passes through a URL with no transformation segment to rewrite', () => {
    const bare = 'https://static.www.nfl.com/league/skoecv9k14idjai4ok42';
    expect(sizedHeadshotUrl(bare, 44)).toBe(bare);
  });

  it('returns undefined when there is no headshot, so the caller draws its placeholder', () => {
    expect(sizedHeadshotUrl(undefined, 44)).toBeUndefined();
  });
});
