import { describe, expect, it } from 'vitest';

import {
  combineDurationParts,
  formatDurationMinutes,
  normalizeDurationMinutes,
  parseDurationMinutes,
  splitDurationMinutes,
} from './task-duration';

describe('parseDurationMinutes', () => {
  it('parses minutes phrases', () => {
    expect(parseDurationMinutes('30 mins')).toBe(30);
    expect(parseDurationMinutes('45 minutes')).toBe(45);
    expect(parseDurationMinutes('15m')).toBe(15);
  });

  it('parses hour phrases', () => {
    expect(parseDurationMinutes('2 hours')).toBe(120);
    expect(parseDurationMinutes('1h')).toBe(60);
    expect(parseDurationMinutes('1.5 hours')).toBe(90);
  });

  it('parses combined hour and minute phrases', () => {
    expect(parseDurationMinutes('1h 30m')).toBe(90);
    expect(parseDurationMinutes('2 hours 15 mins')).toBe(135);
    expect(parseDurationMinutes('1 hour and 5 minutes')).toBe(65);
  });

  it('returns null when duration is missing or invalid', () => {
    expect(parseDurationMinutes('')).toBeNull();
    expect(parseDurationMinutes('tomorrow')).toBeNull();
    expect(parseDurationMinutes('0')).toBeNull();
    expect(parseDurationMinutes('-30')).toBeNull();
  });
});

describe('normalizeDurationMinutes', () => {
  it('accepts integers and rejects out-of-range values', () => {
    expect(normalizeDurationMinutes(30)).toBe(30);
    expect(normalizeDurationMinutes(0)).toBeNull();
    expect(normalizeDurationMinutes(10081)).toBeNull();
    expect(normalizeDurationMinutes(null)).toBeNull();
  });
});

describe('duration parts', () => {
  it('splits and combines hours and minutes', () => {
    expect(splitDurationMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(combineDurationParts(1, 30)).toBe(90);
    expect(combineDurationParts(0, 0)).toBeNull();
  });

  it('formats compact labels', () => {
    expect(formatDurationMinutes(30)).toBe('30m');
    expect(formatDurationMinutes(120)).toBe('2h');
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(null)).toBeNull();
  });
});
