import { describe, expect, it } from 'vitest';

import pathsConfig from '~/config/paths.config';

import {
  documentDetailPath,
  documentEditPath,
  documentListPath,
} from './document-kind';

describe('document paths', () => {
  it('sends surveys to the hub and proposals to the editor', () => {
    expect(documentDetailPath('acme', 'surv-1', 'survey_report')).toBe(
      '/app/acme/surveys/surv-1',
    );
    expect(documentEditPath('acme', 'surv-1', 'survey_report')).toBe(
      '/app/acme/surveys/surv-1/edit',
    );
    expect(documentDetailPath('acme', 'prop-1', 'proposal')).toBe(
      '/app/acme/proposals/prop-1/edit',
    );
    expect(documentListPath('acme', 'survey_report')).toBe('/app/acme/surveys');
  });

  it('keeps survey photo share on a public token path', () => {
    expect(
      pathsConfig.app.surveyPhotoShare.replace('[token]', 'abc123token'),
    ).toBe('/share/survey-photos/abc123token');
    expect(
      pathsConfig.app.accountSurveyStyleSettings.replace('[account]', 'acme'),
    ).toBe('/app/acme/settings/survey-style');
  });
});
