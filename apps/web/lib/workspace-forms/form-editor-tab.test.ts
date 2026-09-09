import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FORM_EDITOR_TAB,
  FORM_EDITOR_TAB_IDS,
  formEditorTabHref,
  isFormEditorTab,
  parseFormEditorTab,
} from './form-editor-tab';

describe('parseFormEditorTab', () => {
  it('defaults to submissions when missing or unknown', () => {
    expect(parseFormEditorTab(null)).toBe('submissions');
    expect(parseFormEditorTab(undefined)).toBe('submissions');
    expect(parseFormEditorTab('')).toBe('submissions');
    expect(parseFormEditorTab('builder-old')).toBe('submissions');
    expect(DEFAULT_FORM_EDITOR_TAB).toBe('submissions');
  });

  it('accepts every current editor tab', () => {
    for (const tab of FORM_EDITOR_TAB_IDS) {
      expect(parseFormEditorTab(tab)).toBe(tab);
      expect(isFormEditorTab(tab)).toBe(true);
    }
  });
});

describe('formEditorTabHref', () => {
  it('sets tab and keeps other query params', () => {
    expect(formEditorTabHref('/app/studio/forms/form-1', 'notifications')).toBe(
      '/app/studio/forms/form-1?tab=notifications',
    );
    expect(
      formEditorTabHref(
        '/app/studio/forms/form-1',
        'share',
        new URLSearchParams('foo=1'),
      ),
    ).toBe('/app/studio/forms/form-1?foo=1&tab=share');
    expect(
      formEditorTabHref(
        '/app/studio/forms/form-1',
        'builder',
        'foo=1&tab=notifications',
      ),
    ).toBe('/app/studio/forms/form-1?foo=1&tab=builder');
  });
});
