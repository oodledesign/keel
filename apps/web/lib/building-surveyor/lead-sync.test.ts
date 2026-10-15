import { describe, expect, it } from 'vitest';

import {
  type LeadSyncSource,
  type LinkedDocument,
  buildDraftPatchFromLead,
  decideQuoteBody,
  hashQuoteHtml,
  leadPatchFromSurvey,
} from './lead-sync';

const LEAD: LeadSyncSource = {
  contactName: 'Jane Doe',
  contactEmail: 'jane@example.com',
  addressLine1: '1 High Street',
  addressLine2: null,
  town: 'Bath',
  postcode: 'BA1 1AA',
  surveyType: 'rics_hss_l3',
  value: 650,
};

function doc(overrides: Partial<LinkedDocument>): LinkedDocument {
  return {
    id: 'doc-1',
    kind: 'proposal',
    status: 'draft',
    recipient_name: null,
    recipient_email: null,
    survey_property_address: null,
    survey_property_postcode: null,
    survey_type: null,
    survey_level: null,
    total_pence: null,
    content_html: null,
    quote_html_hash: null,
    ...overrides,
  };
}

describe('buildDraftPatchFromLead', () => {
  it('patches a draft quote with client, address, type and fee', () => {
    expect(buildDraftPatchFromLead(LEAD, doc({}))).toEqual({
      recipient_name: 'Jane Doe',
      recipient_email: 'jane@example.com',
      survey_property_address: '1 High Street, Bath',
      survey_property_postcode: 'BA1 1AA',
      survey_type: 'rics_hss_l3',
      total_pence: 65000,
    });
  });

  it('sets the level on a draft survey but not the fee', () => {
    const patch = buildDraftPatchFromLead(LEAD, doc({ kind: 'survey_report' }));
    expect(patch.survey_level).toBe(3);
    expect(patch.survey_type).toBe('rics_hss_l3');
    expect(patch).not.toHaveProperty('total_pence');
  });

  it('never touches sent documents', () => {
    expect(buildDraftPatchFromLead(LEAD, doc({ status: 'sent' }))).toEqual({});
    expect(
      buildDraftPatchFromLead(
        LEAD,
        doc({ kind: 'survey_report', status: 'sent' }),
      ),
    ).toEqual({});
  });

  it('returns nothing when the draft already matches', () => {
    expect(
      buildDraftPatchFromLead(
        LEAD,
        doc({
          recipient_name: 'Jane Doe',
          recipient_email: 'jane@example.com',
          survey_property_address: '1 High Street, Bath',
          survey_property_postcode: 'BA1 1AA',
          survey_type: 'rics_hss_l3',
          total_pence: 65000,
        }),
      ),
    ).toEqual({});
  });
});

describe('decideQuoteBody', () => {
  const generated = '<p>Quote v1</p>';
  const regenerated = '<p>Quote v2</p>';

  it('regenerates an unedited body', () => {
    expect(
      decideQuoteBody({
        doc: {
          status: 'draft',
          content_html: generated,
          quote_html_hash: hashQuoteHtml(generated),
        },
        regeneratedHtml: regenerated,
      }),
    ).toBe('regenerate');
  });

  it('keeps an edited body and flags it', () => {
    expect(
      decideQuoteBody({
        doc: {
          status: 'draft',
          content_html: '<p>Edited by hand</p>',
          quote_html_hash: hashQuoteHtml(generated),
        },
        regeneratedHtml: regenerated,
      }),
    ).toBe('keep_edited');
  });

  it('leaves an edited body alone when the quote itself would not change', () => {
    expect(
      decideQuoteBody({
        doc: {
          status: 'draft',
          content_html: '<p>Edited by hand</p>',
          quote_html_hash: hashQuoteHtml(generated),
        },
        regeneratedHtml: generated,
      }),
    ).toBe('unchanged');
  });

  it('ignores sent quotes and quotes without a stored hash', () => {
    expect(
      decideQuoteBody({
        doc: {
          status: 'sent',
          content_html: generated,
          quote_html_hash: hashQuoteHtml(generated),
        },
        regeneratedHtml: regenerated,
      }),
    ).toBe('unchanged');
    expect(
      decideQuoteBody({
        doc: {
          status: 'draft',
          content_html: generated,
          quote_html_hash: null,
        },
        regeneratedHtml: regenerated,
      }),
    ).toBe('unchanged');
  });
});

describe('leadPatchFromSurvey', () => {
  it('writes a changed address, postcode, level and client back to the lead', () => {
    expect(
      leadPatchFromSurvey(LEAD, {
        survey_property_address: '2 Low Road, Bristol',
        survey_property_postcode: 'BS1 1AA',
        survey_level: 2,
        recipient_name: 'John Doe',
      }),
    ).toEqual({
      address_line_1: '2 Low Road, Bristol',
      address_line_2: null,
      town: null,
      postcode: 'BS1 1AA',
      survey_type: 'rics_hss_l2',
      contact_name: 'John Doe',
    });
  });

  it('does nothing when the survey matches the lead', () => {
    expect(
      leadPatchFromSurvey(LEAD, {
        survey_property_address: '1 High Street, Bath',
        survey_property_postcode: 'BA1 1AA',
        survey_level: 3,
        recipient_name: 'Jane Doe',
      }),
    ).toEqual({});
  });

  it('keeps a commercial lead type', () => {
    expect(
      leadPatchFromSurvey(
        { ...LEAD, surveyType: 'commercial_condition' },
        {
          survey_property_address: null,
          survey_property_postcode: null,
          survey_level: 2,
          recipient_name: null,
        },
      ),
    ).toEqual({});
  });
});
