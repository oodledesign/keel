import { describe, expect, it } from 'vitest';

import { extractContactFromValues } from './form-fields';
import {
  defaultMailingListFormFields,
  ensureMailingListFields,
  extractMailingListSpec,
  isMailingListOptedIn,
  parsePoundsToPence,
  parseRadiusMiles,
  parseTenureOption,
  parseUseClassOption,
} from './mailing-list-fields';

describe('mailing list form fields', () => {
  it('defaults business fields without property spec keys', () => {
    const keys = defaultMailingListFormFields({ commercial: false }).map(
      (field) => field.key,
    );
    expect(keys).toEqual([
      'name',
      'email',
      'phone',
      'company_name',
      'message',
      'marketing_opt_in',
    ]);
  });

  it('defaults commercial fields onto the requirement schema', () => {
    const keys = defaultMailingListFormFields({ commercial: true }).map(
      (field) => field.key,
    );
    expect(keys).toContain('sector');
    expect(keys).toContain('tenure');
    expect(keys).toContain('location_text');
    expect(keys).toContain('search_radius_miles');
    expect(keys).toContain('size_min_sqft');
    expect(keys).toContain('use_class');
    expect(keys).toContain('budget_min');
    expect(keys).toContain('listing_id');
    expect(keys).toContain('marketing_opt_in');
  });

  it('adds missing mailing-list fields once', () => {
    const first = ensureMailingListFields([], { commercial: false });
    expect(first.some((field) => field.key === 'marketing_opt_in')).toBe(true);
    expect(ensureMailingListFields(first, { commercial: false })).toHaveLength(
      first.length,
    );
  });

  it('maps extras onto the existing requirement spec', () => {
    const fields = defaultMailingListFormFields({ commercial: true });
    const contact = extractContactFromValues(fields, {
      name: 'Jane Doe',
      email: 'jane@example.com',
      company_name: 'Acme Ltd',
      sector: 'Offices',
      tenure: 'To let',
      location_text: 'Leeds',
      search_radius_miles: '5 miles',
      size_min_sqft: '1500',
      size_max_sqft: '4000',
      use_class: 'Class E (Retail, Offices)',
      budget_min: '25000',
      budget_max: '40000',
      message: 'Need parking',
      marketing_opt_in: true,
    });

    expect(isMailingListOptedIn(contact)).toBe(true);

    const spec = extractMailingListSpec(contact);
    expect(spec.companyName).toBe('Acme Ltd');
    expect(spec.sector).toBe('Offices');
    expect(spec.tenure).toBe('rent');
    expect(spec.locationText).toBe('Leeds');
    expect(spec.searchRadiusMiles).toBe(5);
    expect(spec.sizeMinSqft).toBe(1500);
    expect(spec.sizeMaxSqft).toBe(4000);
    expect(spec.useClass).toBe('class_e');
    expect(spec.budgetMinPence).toBe(2_500_000);
    expect(spec.budgetMaxPence).toBe(4_000_000);
    expect(spec.notes).toBe('Need parking');
  });

  it('parses tenure, radius, money, and use class labels', () => {
    expect(parseTenureOption('For sale')).toBe('buy');
    expect(parseTenureOption('Both')).toBe('both');
    expect(parseRadiusMiles('This area only')).toBe(0);
    expect(parsePoundsToPence('£12,000')).toBe(1_200_000);
    expect(parseUseClassOption('Class B (Industrial)')).toBe('class_b');
  });
});
