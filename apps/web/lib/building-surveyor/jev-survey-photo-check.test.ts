import { describe, expect, it } from 'vitest';

import { filterReportablePhotoIds } from './jev-survey-photo-check';

describe('filterReportablePhotoIds', () => {
  it('keeps photos with no suggestion or unknown reportable', () => {
    expect(
      filterReportablePhotoIds(['a', 'b', 'c'], [
        {
          photoId: 'a',
          reportable: true,
          reportableNoul: 0.9,
          suggestedGroup: null,
          tagMatch: null,
          tagMismatch: false,
          detail: null,
        },
        {
          photoId: 'b',
          reportable: null,
          reportableNoul: 0.5,
          suggestedGroup: null,
          tagMatch: null,
          tagMismatch: false,
          detail: null,
        },
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('drops photos Jev marks non-reportable', () => {
    expect(
      filterReportablePhotoIds(['a', 'b'], [
        {
          photoId: 'a',
          reportable: false,
          reportableNoul: 0.1,
          suggestedGroup: null,
          tagMatch: null,
          tagMismatch: false,
          detail: 'blur',
        },
        {
          photoId: 'b',
          reportable: true,
          reportableNoul: 0.8,
          suggestedGroup: 'D',
          tagMatch: null,
          tagMismatch: false,
          detail: null,
        },
      ]),
    ).toEqual(['b']);
  });
});
