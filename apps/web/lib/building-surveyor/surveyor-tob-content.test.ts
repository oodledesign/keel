import { describe, expect, it } from 'vitest';

import {
  applyLeadSmartFields,
  buildSurveyorLeadSmartFields,
  defaultSurveyorTobHtml,
  surveyTypeLabelForTob,
  surveyorTobTemplateName,
} from './surveyor-tob-content';

describe('surveyor tob content', () => {
  it('names templates by survey type', () => {
    expect(surveyorTobTemplateName('rics_hss_l2')).toContain('Level 2');
    expect(surveyorTobTemplateName('commercial_condition')).toContain(
      'Commercial',
    );
    expect(surveyTypeLabelForTob('rics_hss_l3')).toContain('Level 3');
  });

  it('includes lead merge fields in the default HTML', () => {
    const html = defaultSurveyorTobHtml('rics_hss_l3');
    expect(html).toContain('{{lead.propertyAddress}}');
    expect(html).toContain('{{lead.inspectionAt}}');
    expect(html).toContain('{{lead.feeIncVat}}');
  });
});

describe('buildSurveyorLeadSmartFields', () => {
  it('formats fee and inspection, preferring trading account name', () => {
    const fields = buildSurveyorLeadSmartFields({
      accountName: 'Bracketts LLP',
      signatoryName: 'Ben Carey',
      signatoryTitle: 'Partner',
      lead: {
        dealId: '11111111-1111-1111-1111-111111111111',
        contactName: 'Alex Client',
        contactEmail: 'alex@example.com',
        contactPhone: '07700 900123',
        clientAddress: '1 Client Road',
        surveyType: 'rics_hss_l3',
        inspectionAt: '2026-10-20T09:30:00.000Z',
        value: 650,
        addressLine1: '27 Arundel Road',
        addressLine2: null,
        town: 'Tunbridge Wells',
        postcode: 'TN1 1TB',
        name: 'Arundel',
      },
    });
    expect(fields['{{account.name}}']).toBe('Bracketts LLP');
    expect(fields['{{lead.clientName}}']).toBe('Alex Client');
    expect(fields['{{lead.propertyAddress}}']).toContain('Arundel Road');
    expect(fields['{{lead.feeExVat}}']).toContain('650');
    expect(fields['{{lead.signatoryName}}']).toBe('Ben Carey');
  });

  it('applies tokens into template HTML', () => {
    const html = applyLeadSmartFields(
      'Hello {{lead.clientName}} from {{account.name}}',
      {
        '{{lead.clientName}}': 'Alex',
        '{{account.name}}': 'Bracketts LLP',
      },
    );
    expect(html).toBe('Hello Alex from Bracketts LLP');
  });
});
