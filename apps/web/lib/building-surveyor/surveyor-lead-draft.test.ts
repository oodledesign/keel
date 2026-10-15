import { describe, expect, it } from 'vitest';

import {
  EMPTY_SURVEYOR_LEAD_DRAFT,
  joinLocalDateTime,
  leadAddressLine,
  leadDraftToSaveInput,
  splitLocalDateTime,
} from './surveyor-lead-draft';

describe('local date and time', () => {
  it('round-trips a local inspection time', () => {
    const iso = joinLocalDateTime('2027-03-04', '14:30');
    expect(iso).not.toBeNull();
    expect(splitLocalDateTime(iso)).toEqual({
      date: '2027-03-04',
      time: '14:30',
    });
  });

  it('defaults the time to 09:00 and handles empty dates', () => {
    expect(splitLocalDateTime(joinLocalDateTime('2027-03-04', ''))).toEqual({
      date: '2027-03-04',
      time: '09:00',
    });
    expect(joinLocalDateTime('', '10:00')).toBeNull();
    expect(splitLocalDateTime(null)).toEqual({ date: '', time: '' });
  });
});

describe('leadAddressLine', () => {
  it('joins the filled parts', () => {
    expect(
      leadAddressLine({
        addressLine1: '1 High St',
        addressLine2: ' ',
        town: 'Bath',
      }),
    ).toBe('1 High St, Bath');
  });
});

describe('leadDraftToSaveInput', () => {
  it('maps the instruction sheet to deal and lead fields', () => {
    const input = leadDraftToSaveInput({
      ...EMPTY_SURVEYOR_LEAD_DRAFT,
      stage: 'enquiry',
      contactName: ' Jane Doe ',
      addressLine1: '1 High St',
      town: 'Bath',
      latitude: '51.38',
      longitude: '-2.36',
      fee: '£650.40',
      purchasePrice: '425,000',
      bedrooms: '3',
      surveyType: 'rics_hss_l2',
      comments: '  ',
    });
    expect(input.contactName).toBe('Jane Doe');
    expect(input.companyName).toBe('1 High St, Bath');
    expect(input.value).toBe(650);
    expect(input.description).toBeNull();
    expect(input.property.longitude).toBe(-2.36);
    expect(input.lead.purchasePricePence).toBe(42_500_000);
    expect(input.lead.bedrooms).toBe(3);
    expect(input.lead.surveyType).toBe('rics_hss_l2');
    expect(input.lead.inspectionAt).toBeNull();
  });
});
