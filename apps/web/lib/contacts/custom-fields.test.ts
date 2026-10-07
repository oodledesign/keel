import { describe, expect, it } from 'vitest';

import {
  type ContactCustomFieldDefinition,
  coerceContactFieldValue,
  contactFieldTypeForFormField,
  isValidContactFieldKey,
  sanitizeContactCustomValues,
  slugifyContactFieldKey,
  uniqueContactFieldKey,
} from './custom-fields';

const def = (
  key: string,
  fieldType: ContactCustomFieldDefinition['fieldType'],
  options: string[] = [],
): ContactCustomFieldDefinition => ({
  id: key,
  key,
  label: key,
  fieldType,
  options,
  position: 0,
});

describe('keys', () => {
  it('slugifies labels', () => {
    expect(slugifyContactFieldKey('Lead source!')).toBe('lead_source');
    expect(slugifyContactFieldKey('1st contact')).toBe('f_1st_contact');
    expect(slugifyContactFieldKey('Email')).toBe('email_custom');
  });

  it('avoids collisions', () => {
    expect(uniqueContactFieldKey('Budget', ['budget'])).toBe('budget_2');
    expect(uniqueContactFieldKey('Budget', [])).toBe('budget');
  });

  it('rejects reserved and malformed keys', () => {
    expect(isValidContactFieldKey('budget')).toBe(true);
    expect(isValidContactFieldKey('email')).toBe(false);
    expect(isValidContactFieldKey('Bad Key')).toBe(false);
  });
});

describe('coerceContactFieldValue', () => {
  it('handles numbers', () => {
    expect(coerceContactFieldValue(def('a', 'number'), '£1,500')).toBe(1500);
    expect(coerceContactFieldValue(def('a', 'number'), 'abc')).toBeNull();
  });

  it('handles checkboxes and yes/no answers', () => {
    expect(coerceContactFieldValue(def('a', 'checkbox'), true)).toBe(true);
    expect(coerceContactFieldValue(def('a', 'checkbox'), 'No')).toBe(false);
    expect(coerceContactFieldValue(def('a', 'checkbox'), 'maybe')).toBeNull();
  });

  it('validates dates', () => {
    expect(coerceContactFieldValue(def('a', 'date'), '2026-10-07')).toBe(
      '2026-10-07',
    );
    expect(coerceContactFieldValue(def('a', 'date'), 'tomorrow')).toBeNull();
  });

  it('matches select options case-insensitively', () => {
    const select = def('a', 'select', ['Office', 'Retail']);
    expect(coerceContactFieldValue(select, 'retail')).toBe('Retail');
    expect(coerceContactFieldValue(select, 'Industrial')).toBeNull();
  });
});

describe('sanitizeContactCustomValues', () => {
  it('drops unknown keys and invalid values', () => {
    expect(
      sanitizeContactCustomValues(
        [def('budget', 'number'), def('source', 'text')],
        { budget: '2000', source: '  ', other: 'x' },
      ),
    ).toEqual({ budget: 2000 });
  });
});

describe('contactFieldTypeForFormField', () => {
  it('maps form types', () => {
    expect(contactFieldTypeForFormField('yes_no')).toBe('checkbox');
    expect(contactFieldTypeForFormField('radio')).toBe('select');
    expect(contactFieldTypeForFormField('textarea')).toBe('text');
  });
});
