import { describe, expect, it } from 'vitest';

import type { WorkspaceFormField } from './form-fields';
import {
  countSubmissionStats,
  defaultSubmissionColumnIds,
  findAttendanceField,
  groupSubmissionIdsByEmail,
  listFilledSubmissionAnswers,
  listSubmissionColumnOptions,
  normalizeSubmissionEmail,
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
  }> = {},
) {
  return {
    id,
    contactName: extras.contactName ?? 'Ada',
    contactEmail: email,
    contactPhone: null,
    payload: extras.payload ?? {},
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
