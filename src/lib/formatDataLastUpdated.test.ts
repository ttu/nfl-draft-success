import { describe, it, expect } from 'vitest';
import { formatDataLastUpdatedDate } from './formatDataLastUpdated';

describe('formatDataLastUpdatedDate', () => {
  it('formats stored date-only stamp (YYYY-MM-DD)', () => {
    expect(formatDataLastUpdatedDate('2026-04-30')).toBe('30 April 2026');
  });

  it('formats legacy full ISO timestamps', () => {
    expect(formatDataLastUpdatedDate('2026-04-30T07:13:25.776Z')).toBe(
      '30 April 2026',
    );
  });

  it('returns empty string for invalid input', () => {
    expect(formatDataLastUpdatedDate('')).toBe('');
    expect(formatDataLastUpdatedDate('not-a-date')).toBe('');
  });
});
