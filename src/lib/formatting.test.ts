import { describe, it, expect } from 'vitest';
import {
  getNameInitials,
  formatSnapPercent,
  pluralizeSeasons,
  pluralizeRoles,
  formatDraftRangeSuffix,
} from './formatting';

describe('getNameInitials', () => {
  it('returns up to two uppercase initials', () => {
    expect(getNameInitials('Patrick Mahomes')).toBe('PM');
    expect(getNameInitials('Cher')).toBe('C');
  });

  it('clips to two characters even for longer names', () => {
    expect(getNameInitials('Robert Griffin III')).toBe('RG');
  });

  it('handles multiple whitespace separators', () => {
    expect(getNameInitials('Tom   Brady')).toBe('TB');
  });
});

describe('formatSnapPercent', () => {
  it('formats share as one-decimal percent', () => {
    expect(formatSnapPercent(0.4567)).toBe('45.7%');
    expect(formatSnapPercent(0)).toBe('0%');
    expect(formatSnapPercent(1)).toBe('100%');
  });

  it('rounds to one decimal place', () => {
    expect(formatSnapPercent(0.12345)).toBe('12.3%');
    expect(formatSnapPercent(0.12349)).toBe('12.3%');
    expect(formatSnapPercent(0.12356)).toBe('12.4%');
  });
});

describe('pluralizeSeasons', () => {
  it('uses singular for 1', () => {
    expect(pluralizeSeasons(1)).toBe('1 season');
  });

  it('uses plural otherwise', () => {
    expect(pluralizeSeasons(0)).toBe('0 seasons');
    expect(pluralizeSeasons(5)).toBe('5 seasons');
  });
});

describe('pluralizeRoles', () => {
  it('uses singular for 1', () => {
    expect(pluralizeRoles(1)).toBe('1 role');
  });

  it('uses plural otherwise', () => {
    expect(pluralizeRoles(3)).toBe('3 roles');
  });
});

describe('formatDraftRangeSuffix', () => {
  it('renders single-year range with middle-dot', () => {
    expect(formatDraftRangeSuffix(2023, 2023)).toBe(' · 2023');
  });

  it('renders multi-year range with en-dash', () => {
    expect(formatDraftRangeSuffix(2021, 2024)).toBe(' — drafts 2021–2024');
  });
});
