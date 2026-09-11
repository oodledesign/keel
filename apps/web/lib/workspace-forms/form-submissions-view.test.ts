import { describe, expect, it } from 'vitest';

import type { WorkspaceFormField } from './form-fields';
import {
  countRsvpAttendeeTotals,
  countSubmissionStats,
  defaultSubmissionColumnIds,
  findAttendanceField,
  findGuestField,
  groupSubmissionIdsByEmail,
  isAttendingResponse,
  listFilledSubmissionAnswers,
  listSubmissionColumnOptions,
  normalizeSubmissionEmail,
  parseGuestCount,
  parseStoredSubmissionColumns,
  sanitizeSubmissionColumnIds,
  selectUniqueSubmissions,
  submissionBuiltinValue,
  submissionRecordLabel,
} from './form-submissions-view';
import { workspaceFormFieldsForTemplate } from './form-templates';

const rsvpFields = workspaceFormFieldsForTemplate('rsvp');

function submission(
  id: string,
  email: string | null,
  extras: Partial<{
    contactName: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }> = {},
) {
  return {
    id,
    contactName: extras.contactName ?? 'Ada',
    contactEmail: email,
    contactPhone: null,
    payload: extras.payload ?? {},
    createdAt: extras.createdAt ?? '2026-09-09T15:04:00.000Z',
  };
}

describe('normalizeSubmissionEmail', () => {
  it('trims and lowercases, and treats blank as missing', () => {
    expect(normalizeSubmissionEmail('  Ada@Example.com ')).toBe(
      'ada@example.com',
    );
    expect(normalizeSubmissionEmail('')).toBeNull();
    expect(normalizeSubmissionEmail('   ')).toBeNull();
    expect(normalizeSubmissionEmail(null)).toBeNull();
  });
});

describe('countSubmissionStats', () => {
  it('counts unique emails and treats missing emails as unique ids', () => {
    expect(
      countSubmissionStats([
        submission('1', 'ada@example.com'),
        submission('2', 'ADA@example.com'),
        submission('3', 'sam@example.com'),
        submission('4', null),
        submission('5', '  '),
      ]),
    ).toEqual({ total: 5, unique: 4 });
  });
});

describe('selectUniqueSubmissions', () => {
  it('keeps the latest row per email and every missing-email row', () => {
    expect(
      selectUniqueSubmissions([
        { id: 'old', contactEmail: 'ada@example.com', createdAt: '2026-01-01' },
        { id: 'new', contactEmail: 'ADA@example.com', createdAt: '2026-03-01' },
        { id: 'none', contactEmail: null, createdAt: '2026-02-01' },
      ]).map((item) => item.id),
    ).toEqual(['new', 'none']);
  });
});

describe('submissionRecordLabel', () => {
  it('prefers linked records and falls back for list-only forms', () => {
    expect(submissionRecordLabel({ commercialEnquiryId: 'e1' }, false)).toBe(
      'Listing enquiry',
    );
    expect(submissionRecordLabel({ clientId: 'c1' }, false)).toBe(
      'Mailing-list contact',
    );
    expect(submissionRecordLabel({}, true)).toBe('Submission');
    expect(submissionRecordLabel({}, false)).toBe('Stored only');
  });
});

describe('groupSubmissionIdsByEmail', () => {
  it('groups case-insensitively and skips blank emails', () => {
    const groups = groupSubmissionIdsByEmail([
      submission('1', 'ada@example.com'),
      submission('2', 'ADA@example.com'),
      submission('3', null),
    ]);
    expect(groups.get('ada@example.com')).toEqual(['1', '2']);
    expect(groups.size).toBe(1);
  });
});

describe('submission columns', () => {
  it('defaults contact forms to received, name, email, record', () => {
    expect(
      defaultSubmissionColumnIds(workspaceFormFieldsForTemplate('contact')),
    ).toEqual(['received', 'name', 'email', 'record']);
  });

  it('defaults to received, name, email, attendance, record for RSVP', () => {
    expect(defaultSubmissionColumnIds(rsvpFields)).toEqual([
      'received',
      'name',
      'email',
      'field:attendance',
      'record',
    ]);
    expect(findAttendanceField(rsvpFields)?.key).toBe('attendance');
    expect(findGuestField(rsvpFields)?.key).toBe('guests');
  });

  it('lists builtins plus form fields except name/email types', () => {
    const options = listSubmissionColumnOptions(rsvpFields);
    expect(options.map((item) => item.id)).toContain('received');
    expect(options.map((item) => item.id)).toContain('field:attendance');
    expect(options.map((item) => item.id)).toContain('field:guests');
    expect(options.some((item) => item.id === 'field:name')).toBe(false);
    expect(options.some((item) => item.id === 'field:email')).toBe(false);
    expect(options.some((item) => item.id === 'field:phone')).toBe(false);
  });

  it('sanitizes stored columns against the allowed set', () => {
    const allowed = new Set(['received', 'name', 'field:attendance']);
    expect(
      sanitizeSubmissionColumnIds(
        ['received', 'field:missing', 'name', 3],
        allowed,
      ),
    ).toEqual(['received', 'name']);
    expect(parseStoredSubmissionColumns('not-json', allowed)).toBeNull();
    expect(parseStoredSubmissionColumns('[]', allowed)).toBeNull();
  });
});

describe('submission values', () => {
  it('prefers contact fields and lists filled answers only', () => {
    const row = submission('1', 'ada@example.com', {
      contactName: 'Ada Lovelace',
      payload: {
        name: 'Ignored',
        attendance: 'Yes',
        guests: '2',
        dietary: '  ',
      },
    });
    expect(submissionBuiltinValue(row, 'name')).toBe('Ada Lovelace');
    expect(submissionBuiltinValue(row, 'email')).toBe('ada@example.com');
    expect(
      listFilledSubmissionAnswers(rsvpFields as WorkspaceFormField[], row).map(
        (item) => item.key,
      ),
    ).toEqual(['name', 'email', 'attendance', 'guests']);
  });
});

describe('RSVP attendee totals', () => {
  it('detects guest fields by key or label and skips attendance', () => {
    expect(
      findGuestField([
        {
          id: 'plus',
          type: 'text',
          key: 'plus_ones',
          label: 'How many plus ones?',
          required: false,
        },
      ])?.key,
    ).toBe('plus_ones');
    expect(
      findGuestField([
        {
          id: 'bringing',
          type: 'select',
          key: 'bringing',
          label: 'Number of guests',
          required: false,
          options: ['0', '1', '2'],
        },
      ])?.key,
    ).toBe('bringing');
    expect(findGuestField(rsvpFields as WorkspaceFormField[])?.key).not.toBe(
      'attendance',
    );
    expect(
      findGuestField(workspaceFormFieldsForTemplate('contact')),
    ).toBeNull();
    expect(
      findGuestField([
        {
          id: 'notes',
          type: 'textarea',
          key: 'guest_notes',
          label: 'Tell us about your plus ones',
          required: false,
        },
      ]),
    ).toBeNull();
  });

  it('treats Yes-like attendance values as attending', () => {
    expect(isAttendingResponse('Yes')).toBe(true);
    expect(isAttendingResponse(' attending ')).toBe(true);
    expect(isAttendingResponse('No')).toBe(false);
    expect(isAttendingResponse('Maybe')).toBe(false);
    expect(isAttendingResponse('')).toBe(false);
    expect(parseGuestCount('2')).toBe(2);
    expect(parseGuestCount('2 guests')).toBe(2);
    expect(parseGuestCount('')).toBe(0);
    expect(parseGuestCount('none')).toBe(0);
  });

  it('counts unique Yes invitees plus their guests, ignoring No and stale repeats', () => {
    const totals = countRsvpAttendeeTotals(rsvpFields as WorkspaceFormField[], [
      submission('old-yes', 'ada@example.com', {
        createdAt: '2026-01-01T10:00:00.000Z',
        payload: { attendance: 'Yes', guests: '4' },
      }),
      submission('new-yes', 'ADA@example.com', {
        createdAt: '2026-03-01T10:00:00.000Z',
        payload: { attendance: 'Yes', guests: '2' },
      }),
      submission('sam-no', 'sam@example.com', {
        createdAt: '2026-02-01T10:00:00.000Z',
        payload: { attendance: 'No', guests: '3' },
      }),
      submission('anon-yes', null, {
        createdAt: '2026-04-01T10:00:00.000Z',
        payload: { attendance: 'Yes', guests: '' },
      }),
    ]);

    expect(totals).toEqual({
      invitees: 2,
      guests: 2,
      totalAttendees: 4,
    });
  });

  it('returns null when the form has no attendance field', () => {
    expect(
      countRsvpAttendeeTotals(workspaceFormFieldsForTemplate('contact'), [
        submission('1', 'ada@example.com'),
      ]),
    ).toBeNull();
  });
});
