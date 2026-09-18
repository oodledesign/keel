import { describe, expect, it } from 'vitest';

import pathsConfig from '~/config/paths.config';
import { FAMILY_WORKSPACE_MODULE_ORDER } from '~/config/workspace-module-order';
import {
  birthdayIsoFromParts,
  childInitials,
  formatChildAge,
  isMemoryNoteCategory,
  memoryKindFromTags,
  memoryKindTag,
  memoryOccurredOn,
  withMemoryKindTags,
} from '~/home/[account]/memories/_lib/memory-constants';

describe('memoryKindFromTags', () => {
  it('reads the reserved mk: prefix first', () => {
    expect(memoryKindFromTags(['school', 'mk:holiday'])).toBe('holiday');
    expect(memoryKindFromTags([memoryKindTag('funny_quote')])).toBe(
      'funny_quote',
    );
  });

  it('falls back to a bare kind slug', () => {
    expect(memoryKindFromTags(['milestone'])).toBe('milestone');
    expect(memoryKindFromTags(['other'])).toBeNull();
  });
});

describe('withMemoryKindTags', () => {
  it('replaces an existing kind tag and keeps other tags', () => {
    expect(withMemoryKindTags(['mk:school', 'poet'], 'firsts')).toEqual([
      'mk:firsts',
      'poet',
    ]);
    expect(withMemoryKindTags(['holiday'], null)).toEqual([]);
  });
});

describe('birthdayIsoFromParts', () => {
  it('builds an ISO date when the year is present', () => {
    expect(birthdayIsoFromParts(2020, 9, 8)).toBe('2020-09-08');
    expect(birthdayIsoFromParts(null, 9, 8)).toBeNull();
  });
});

describe('formatChildAge', () => {
  const now = new Date(2026, 8, 18);

  it('returns years from the first birthday', () => {
    expect(formatChildAge('2020-09-18', now)).toBe('6 years old');
    expect(formatChildAge('2025-09-18', now)).toBe('1 year old');
  });

  it('returns months under one year', () => {
    expect(formatChildAge('2026-03-18', now)).toBe('6 months old');
    expect(formatChildAge('2026-08-18', now)).toBe('1 month old');
  });

  it('rejects invalid or future dates', () => {
    expect(formatChildAge(null, now)).toBeNull();
    expect(formatChildAge('2027-01-01', now)).toBeNull();
    expect(formatChildAge('18-09-2020', now)).toBeNull();
  });
});

describe('memory helpers', () => {
  it('identifies memory notes and event dates', () => {
    expect(isMemoryNoteCategory('memory')).toBe(true);
    expect(isMemoryNoteCategory('idea')).toBe(false);
    expect(memoryOccurredOn('2026-04-01', '2026-09-18T10:00:00Z')).toBe(
      '2026-04-01',
    );
    expect(memoryOccurredOn(null, '2026-09-18T10:00:00Z')).toBe('2026-09-18');
    expect(childInitials('Poet Potter')).toBe('PP');
  });
});

describe('family memories wiring', () => {
  it('places Memories in the family module order and paths', () => {
    expect(FAMILY_WORKSPACE_MODULE_ORDER).toContain('memories');
    expect(FAMILY_WORKSPACE_MODULE_ORDER.indexOf('memories')).toBeLessThan(
      FAMILY_WORKSPACE_MODULE_ORDER.indexOf('notes'),
    );
    expect(pathsConfig.app.accountMemories).toBe('/app/[account]/memories');
    expect(pathsConfig.app.accountMemoryChild).toBe(
      '/app/[account]/memories/children/[personId]',
    );
  });
});
