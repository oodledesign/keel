import { describe, expect, it } from 'vitest';

import {
  applySignatureProfileOverrides,
  directoryResetLabel,
  isSignatureProfileFieldOverridden,
  normalizeSignatureOverride,
  resolveSignatureProfileField,
  signatureOverrideToStore,
  staffProfileOverridePatch,
} from './profile-overrides';

describe('normalizeSignatureOverride', () => {
  it('treats blank and whitespace as null', () => {
    expect(normalizeSignatureOverride(null)).toBeNull();
    expect(normalizeSignatureOverride('')).toBeNull();
    expect(normalizeSignatureOverride('   ')).toBeNull();
  });

  it('trims a real override', () => {
    expect(normalizeSignatureOverride('  Ada  ')).toBe('Ada');
  });
});

describe('resolveSignatureProfileField', () => {
  it('prefers a non-empty override', () => {
    expect(resolveSignatureProfileField('Ada Lovelace', 'Ada L.')).toBe(
      'Ada L.',
    );
  });

  it('falls back to the directory value when override is empty', () => {
    expect(resolveSignatureProfileField('Ada Lovelace', null)).toBe(
      'Ada Lovelace',
    );
    expect(resolveSignatureProfileField('Ada Lovelace', '  ')).toBe(
      'Ada Lovelace',
    );
  });
});

describe('applySignatureProfileOverrides', () => {
  it('leaves directory values when overrides are null', () => {
    expect(
      applySignatureProfileOverrides({
        full_name: 'Ada Lovelace',
        job_title: 'Engineer',
        department: 'Mathematics',
        full_name_override: null,
        job_title_override: null,
        department_override: null,
      }),
    ).toMatchObject({
      full_name: 'Ada Lovelace',
      job_title: 'Engineer',
      department: 'Mathematics',
    });
  });

  it('uses each override independently', () => {
    expect(
      applySignatureProfileOverrides({
        full_name: 'Ada Lovelace',
        job_title: 'Engineer',
        department: 'Mathematics',
        full_name_override: 'Ada L.',
        job_title_override: null,
        department_override: 'Client Services',
      }),
    ).toMatchObject({
      full_name: 'Ada L.',
      job_title: 'Engineer',
      department: 'Client Services',
    });
  });
});

describe('signatureOverrideToStore', () => {
  it('stores null when submitted matches or clears the directory value', () => {
    expect(signatureOverrideToStore('Engineer', 'Engineer')).toBeNull();
    expect(signatureOverrideToStore('Engineer', '')).toBeNull();
    expect(signatureOverrideToStore('Engineer', '  Engineer  ')).toBeNull();
  });

  it('stores a distinct override', () => {
    expect(signatureOverrideToStore('Engineer', 'Head of Engineering')).toBe(
      'Head of Engineering',
    );
  });
});

describe('staffProfileOverridePatch', () => {
  const existing = {
    full_name: 'Ada Lovelace',
    job_title: 'Engineer',
    department: 'Mathematics',
  };

  it('writes only fields that differ from the directory', () => {
    expect(
      staffProfileOverridePatch({
        existing,
        submitted: {
          full_name: 'Ada L.',
          job_title: 'Engineer',
          department: '',
        },
      }),
    ).toEqual({
      full_name_override: 'Ada L.',
      job_title_override: null,
      department_override: null,
    });
  });

  it('clears a field even when a value was submitted', () => {
    expect(
      staffProfileOverridePatch({
        existing,
        submitted: {
          full_name: 'Ada L.',
          job_title: 'Partner',
          department: 'Sales',
        },
        clear: { job_title: true },
      }),
    ).toEqual({
      full_name_override: 'Ada L.',
      job_title_override: null,
      department_override: 'Sales',
    });
  });
});

describe('isSignatureProfileFieldOverridden', () => {
  it('is true only when an override is stored', () => {
    expect(isSignatureProfileFieldOverridden('Ada', 'Ada L.')).toBe(true);
    expect(isSignatureProfileFieldOverridden('Ada', null)).toBe(false);
  });
});

describe('directoryResetLabel', () => {
  it('names the connected directory', () => {
    expect(directoryResetLabel('microsoft')).toBe('Reset to Microsoft');
    expect(directoryResetLabel('google')).toBe('Reset to Google');
  });
});
