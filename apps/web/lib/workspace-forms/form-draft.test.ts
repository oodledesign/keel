import { describe, expect, it } from 'vitest';

import {
  FORM_DRAFT_TTL_DAYS,
  buildFormResumePath,
  buildFormResumeUrl,
  clampFormStepIndex,
  formDraftExpiresAt,
  isFormDraftExpired,
  isLikelyResumeToken,
  resumeEmailFromValues,
  sanitizeFormDraftValues,
} from './form-draft';
import { defaultWorkspaceFormFields } from './form-fields';

describe('form draft expiry', () => {
  it('expires about 30 days after the reference time', () => {
    const from = new Date('2026-09-12T12:00:00.000Z');
    const expires = formDraftExpiresAt(from);
    expect(FORM_DRAFT_TTL_DAYS).toBe(30);
    expect(expires.getTime() - from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(isFormDraftExpired(expires, from)).toBe(false);
    expect(isFormDraftExpired(expires, new Date(expires.getTime() + 1))).toBe(
      true,
    );
  });
});

describe('sanitizeFormDraftValues', () => {
  const fields = defaultWorkspaceFormFields();

  it('keeps known string and boolean answers and drops extras', () => {
    expect(
      sanitizeFormDraftValues(fields, {
        name: 'Ada',
        email: 'ada@example.com',
        extra: 'nope',
        listing_id: 'ignored-without-field',
      }),
    ).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
    });
  });

  it('caps string length and accepts booleans', () => {
    const checkbox = {
      id: 'opt_in',
      type: 'checkbox' as const,
      key: 'opt_in',
      label: 'Opt in',
      required: false,
    };
    expect(
      sanitizeFormDraftValues([checkbox], {
        opt_in: true,
        other: false,
      }),
    ).toEqual({ opt_in: true });

    const long = 'x'.repeat(2500);
    expect(sanitizeFormDraftValues(fields, { name: long }).name).toHaveLength(
      2000,
    );
  });

  it('keeps uploaded file refs on a draft', () => {
    const fileField = {
      id: 'brief',
      type: 'file' as const,
      key: 'brief',
      label: 'Brief',
      required: false,
    };
    const file = {
      name: 'brief.pdf',
      url: 'https://proj.supabase.co/storage/v1/object/public/workspace-form-uploads/acct/form/brief.pdf',
      path: 'acct/form/brief.pdf',
      mimeType: 'application/pdf',
      size: 900,
    };
    expect(sanitizeFormDraftValues([fileField], { brief: file })).toEqual({
      brief: file,
    });
  });
});

describe('resumeEmailFromValues', () => {
  const fields = defaultWorkspaceFormFields();

  it('returns a normalized email only when the email field is valid', () => {
    expect(resumeEmailFromValues(fields, { email: '  Ada@Example.com ' })).toBe(
      'ada@example.com',
    );
    expect(resumeEmailFromValues(fields, { email: 'not-an-email' })).toBeNull();
    expect(resumeEmailFromValues(fields, { name: 'Ada' })).toBeNull();
  });
});

describe('clampFormStepIndex', () => {
  it('clamps into the available step range', () => {
    expect(clampFormStepIndex(0, 4)).toBe(0);
    expect(clampFormStepIndex(3, 4)).toBe(3);
    expect(clampFormStepIndex(9, 4)).toBe(3);
    expect(clampFormStepIndex(-2, 4)).toBe(0);
    expect(clampFormStepIndex(1, 0)).toBe(0);
  });
});

describe('resume URL', () => {
  it('builds a share path with the resume token', () => {
    expect(
      buildFormResumePath({
        shareToken: 'share-token-aaaaaaaa',
        resumeToken: 'resume-token-bbbbbbbb',
        embed: true,
        listingId: 'listing-1',
      }),
    ).toBe(
      '/share/form/share-token-aaaaaaaa?resume=resume-token-bbbbbbbb&embed=1&listing=listing-1',
    );
  });

  it('joins the site origin without a trailing slash', () => {
    expect(
      buildFormResumeUrl({
        shareToken: 'share-token-aaaaaaaa',
        resumeToken: 'resume-token-bbbbbbbb',
        siteUrl: 'https://ozer.so/',
      }),
    ).toBe(
      'https://ozer.so/share/form/share-token-aaaaaaaa?resume=resume-token-bbbbbbbb',
    );
  });

  it('rejects short tokens', () => {
    expect(isLikelyResumeToken('short')).toBe(false);
    expect(isLikelyResumeToken('1234567890123456')).toBe(true);
  });
});
