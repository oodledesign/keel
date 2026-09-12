import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatFormFileValue,
  isAllowedFormUpload,
  isFormUploadPathForForm,
  parseFormFileValue,
} from './form-file';

function storageFile(
  path: string,
  extras: Partial<{ name: string; size: number; url: string }> = {},
) {
  return {
    name: extras.name ?? 'plan.pdf',
    url:
      extras.url ??
      `https://proj.supabase.co/storage/v1/object/public/workspace-form-uploads/${path}`,
    path,
    mimeType: 'application/pdf',
    size: extras.size ?? 2048,
  };
}

describe('form file values', () => {
  it('parses object and JSON file refs', () => {
    const file = storageFile('account/form/uuid-plan.pdf');
    expect(parseFormFileValue(file)).toEqual(file);
    expect(parseFormFileValue(JSON.stringify(file))).toEqual(file);
    expect(parseFormFileValue('not-json')).toBeNull();
    expect(parseFormFileValue({ name: 'x' })).toBeNull();
  });

  it('rejects oversized or odd paths', () => {
    expect(
      parseFormFileValue(
        storageFile('../escape.pdf', {
          name: 'big.pdf',
          size: 100,
        }),
      ),
    ).toBeNull();
    expect(
      parseFormFileValue(
        storageFile('account/form/plan.pdf', {
          url: 'https://attacker.example/malware.pdf',
        }),
      ),
    ).toBeNull();
    expect(
      isAllowedFormUpload({
        mimeType: 'application/pdf',
        fileName: 'big.pdf',
        size: 11 * 1024 * 1024,
      }).ok,
    ).toBe(false);
    expect(
      isAllowedFormUpload({
        mimeType: 'application/zip',
        fileName: 'x.zip',
        size: 100,
      }).ok,
    ).toBe(false);
    expect(
      isAllowedFormUpload({
        mimeType: '',
        fileName: 'photo.JPG',
        size: 100,
      }),
    ).toEqual({ ok: true, mimeType: 'image/jpeg' });
  });

  it('scopes upload paths to the form', () => {
    expect(
      isFormUploadPathForForm(
        '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/file.pdf',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe(true);
    expect(
      isFormUploadPathForForm(
        'other/form/file.pdf',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe(false);
  });

  it('formats file labels and sizes', () => {
    const file = storageFile('a/b/plan.pdf');
    expect(formatFormFileValue(file)).toBe(`plan.pdf (${file.url})`);
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
