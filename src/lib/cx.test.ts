import { describe, it, expect } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy class names with a single space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy entries', () => {
    expect(cx('a', '', 'b')).toBe('a b');
    expect(cx('a', undefined, 'b')).toBe('a b');
    expect(cx('a', false, 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx()).toBe('');
    expect(cx('', undefined, false)).toBe('');
  });

  it('does not leave a trailing space when a modifier is absent', () => {
    const modifier = '';
    expect(cx('score-bar__fill', modifier)).toBe('score-bar__fill');
  });
});
