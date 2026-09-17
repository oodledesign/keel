import { describe, expect, it } from 'vitest';

import {
  buildSurveyorQuoteHtml,
  surveyorQuoteLevelLabel,
  surveyorQuoteLevels,
} from './survey-quote';

describe('surveyorQuoteLevels', () => {
  it('defaults to Level 2 and Level 3 together', () => {
    expect(surveyorQuoteLevels()).toEqual(['2', '3']);
    expect(surveyorQuoteLevelLabel()).toBe(
      'RICS Home Survey Level 2 and Level 3',
    );
  });
});

describe('buildSurveyorQuoteHtml', () => {
  it('includes address, both survey levels, appointment, and Terms of Business', () => {
    const html = buildSurveyorQuoteHtml({
      address: '12 High Street, York',
      clientName: 'Alex Client',
      firmName: 'North Surveyors',
    });
    expect(html).toContain('12 High Street, York');
    expect(html).toContain('Alex Client');
    expect(html).toContain('North Surveyors');
    expect(html).toContain('Level 2 and Level 3');
    expect(html).toContain('Form of appointment');
    expect(html).toContain('Terms of Business');
  });
});
