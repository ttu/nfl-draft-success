import { describe, it, expect } from 'vitest';
import { seasonTag } from './seasonTag';

describe('seasonTag', () => {
  it('renders a two-digit season suffix', () => {
    expect(seasonTag(2021)).toBe("'21");
  });

  it('pads a single-digit year', () => {
    expect(seasonTag(2005)).toBe("'05");
  });
});
