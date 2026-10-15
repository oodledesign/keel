import { describe, expect, it } from 'vitest';

import {
  defaultSurveyorQuoteLetterHtml,
  resolveQuoteLetterHtml,
} from './surveyor-quote-letters';

describe('surveyor-quote-letters', () => {
  it('picks the letter by survey type and applies overrides', () => {
    const level2 = defaultSurveyorQuoteLetterHtml('rics_hss_l2');
    expect(level2).toContain('Level 2');
    expect(level2).toContain('{{lead.feeIncVat}}');

    const overridden = resolveQuoteLetterHtml({
      surveyType: 'rics_hss_l3',
      overrides: { rics_hss_l3: '<p>Custom L3 quote</p>' },
    });
    expect(overridden).toBe('<p>Custom L3 quote</p>');

    const fallback = resolveQuoteLetterHtml({
      surveyType: 'commercial_condition',
      overrides: {},
    });
    expect(fallback).toContain('Commercial');
  });
});
