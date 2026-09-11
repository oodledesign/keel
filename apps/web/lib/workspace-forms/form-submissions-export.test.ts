import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import type { WorkspaceFormField } from './form-fields';
import {
  buildSubmissionExportTable,
  buildSubmissionsExportPdf,
  formatSubmissionExportReceivedAt,
  listAnsweredSubmissionColumnIds,
  resolveExportColumnIds,
  selectSubmissionsForExport,
  slugifySubmissionExportName,
  submissionExportCellValue,
  submissionsExportAttendeeSummary,
  submissionsExportFilename,
  submissionsExportSubtitle,
  submissionsExportToCsv,
} from './form-submissions-export';
import {
  countRsvpAttendeeTotals,
  countSubmissionStats,
  selectUniqueSubmissions,
} from './form-submissions-view';
import { workspaceFormFieldsForTemplate } from './form-templates';

const rsvpFields = workspaceFormFieldsForTemplate(
  'rsvp',
) as WorkspaceFormField[];

function row(
  id: string,
  email: string | null,
  createdAt: string,
  extras: Partial<{
    contactName: string | null;
    contactPhone: string | null;
    payload: Record<string, unknown>;
    clientId: string | null;
  }> = {},
) {
  return {
    id,
    contactName: extras.contactName ?? 'Ada',
    contactEmail: email,
    contactPhone: extras.contactPhone ?? null,
    payload: extras.payload ?? { attendance: 'Yes', guests: '2' },
    createdAt,
    clientId: extras.clientId ?? null,
  };
}

describe('selectUniqueSubmissions', () => {
  it('keeps the latest submission per email and every row without email', () => {
    const selected = selectUniqueSubmissions([
      row('old', 'ada@example.com', '2026-01-01T10:00:00.000Z', {
        contactName: 'Ada old',
      }),
      row('new', 'ADA@example.com', '2026-03-01T10:00:00.000Z', {
        contactName: 'Ada new',
      }),
      row('sam', 'sam@example.com', '2026-02-01T10:00:00.000Z'),
      row('anon-a', null, '2026-04-01T10:00:00.000Z'),
      row('anon-b', '  ', '2026-05-01T10:00:00.000Z'),
    ]);

    expect(selected.map((item) => item.id)).toEqual([
      'anon-b',
      'anon-a',
      'new',
      'sam',
    ]);
    expect(countSubmissionStats(selected).unique).toBe(4);
  });

  it('matches RSVP unique count for the same set', () => {
    const submissions = [
      row('1', 'ada@example.com', '2026-01-01T10:00:00.000Z'),
      row('2', 'ADA@example.com', '2026-02-01T10:00:00.000Z'),
      row('3', 'sam@example.com', '2026-03-01T10:00:00.000Z'),
      row('4', null, '2026-04-01T10:00:00.000Z'),
    ];
    expect(countSubmissionStats(submissions).unique).toBe(
      selectUniqueSubmissions(submissions).length,
    );
  });
});

describe('selectSubmissionsForExport', () => {
  it('returns every row for all, unique latest-per-email otherwise', () => {
    const submissions = [
      row('old', 'ada@example.com', '2026-01-01T10:00:00.000Z'),
      row('new', 'ada@example.com', '2026-02-01T10:00:00.000Z'),
    ];
    expect(selectSubmissionsForExport(submissions, 'all')).toHaveLength(2);
    expect(
      selectSubmissionsForExport(submissions, 'unique').map((item) => item.id),
    ).toEqual(['new']);
  });
});

describe('export columns and cells', () => {
  it('formats received-at in UTC and uses record labels', () => {
    expect(formatSubmissionExportReceivedAt('2026-09-09T15:04:00.000Z')).toBe(
      '09/09/2026 15:04 UTC',
    );

    const submission = row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
      contactName: 'Ada Lovelace',
      clientId: 'client-1',
      payload: { attendance: 'Yes' },
    });
    expect(submissionExportCellValue(submission, 'name', undefined, true)).toBe(
      'Ada Lovelace',
    );
    expect(
      submissionExportCellValue(submission, 'record', undefined, true),
    ).toBe('Mailing-list contact');
    expect(
      submissionExportCellValue(
        submission,
        'field:attendance',
        rsvpFields.find((field) => field.key === 'attendance'),
        true,
      ),
    ).toBe('Yes');
  });

  it('drops unknown columns and falls back when none remain', () => {
    expect(
      resolveExportColumnIds(
        ['received', 'field:missing', 'name'],
        rsvpFields,
        ['email'],
      ),
    ).toEqual(['received', 'name']);
    expect(resolveExportColumnIds(['nope'], rsvpFields, ['email'])).toEqual([
      'email',
    ]);
  });

  it('lists columns that have at least one value', () => {
    const answered = listAnsweredSubmissionColumnIds(
      rsvpFields,
      [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Ada',
          payload: { attendance: 'Yes', guests: '' },
        }),
      ],
      true,
    );
    expect(answered).toContain('received');
    expect(answered).toContain('name');
    expect(answered).toContain('email');
    expect(answered).toContain('field:attendance');
    expect(answered).not.toContain('phone');
    expect(answered).not.toContain('field:guests');
  });
});

describe('CSV export', () => {
  it('includes a BOM and selected headers only', () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Ada Lovelace',
          payload: { attendance: 'Yes', guests: '2' },
        }),
      ],
      columns: ['received', 'name', 'email', 'field:attendance'],
      submissionsOnly: true,
    });
    const csv = submissionsExportToCsv(table);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Submitted at,Name,Email,Will you attend?');
    expect(csv).toContain('Ada Lovelace');
    expect(csv).toContain('ada@example.com');
    expect(csv).toContain('Yes');
    expect(csv).not.toContain('Guests');
  });

  it('neutralizes formula-like values so spreadsheets do not execute them', () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: '=HYPERLINK("https://evil.example")',
          payload: { attendance: '+cmd' },
        }),
      ],
      columns: ['name', 'field:attendance'],
      submissionsOnly: true,
    });
    const csv = submissionsExportToCsv(table);
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(csv).toContain("'+cmd");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('escapes commas and quotes', () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Lovelace, Ada',
          payload: { attendance: 'Yes, "plus one"' },
        }),
      ],
      columns: ['name', 'field:attendance'],
      submissionsOnly: true,
    });
    const csv = submissionsExportToCsv(table);
    expect(csv).toContain('"Lovelace, Ada"');
    expect(csv).toContain('"Yes, ""plus one"""');
  });
});

describe('filename and subtitle', () => {
  it('slugifies the form name and states unique vs all', () => {
    expect(slugifySubmissionExportName(' Summer Party! ')).toBe('summer-party');
    expect(
      submissionsExportFilename({
        formName: 'Summer Party',
        format: 'csv',
        mode: 'unique',
        now: new Date('2026-09-09T12:00:00.000Z'),
      }),
    ).toBe('summer-party-submissions-unique-2026-09-09.csv');
    expect(submissionsExportSubtitle({ mode: 'unique', rowCount: 1 })).toBe(
      'Unique submissions (latest per email) · 1 row',
    );
    expect(submissionsExportSubtitle({ mode: 'all', rowCount: 12 })).toBe(
      'All submissions · 12 rows',
    );
    expect(
      submissionsExportAttendeeSummary({
        invitees: 8,
        guests: 4,
        totalAttendees: 12,
      }),
    ).toBe('12 attendees · 8 invitees + 4 guests');
    expect(
      submissionsExportAttendeeSummary({
        invitees: 1,
        guests: 0,
        totalAttendees: 1,
      }),
    ).toBe('1 attendee · 1 invitee + 0 guests');
  });
});

describe('PDF export', () => {
  it('defaults to a portrait list even with a few columns', async () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Ada',
        }),
      ],
      columns: ['received', 'name', 'email', 'field:attendance'],
      submissionsOnly: true,
    });
    const bytes = await buildSubmissionsExportPdf({
      formName: 'Breakfast Meeting',
      mode: 'all',
      table,
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString('utf8')).toBe('%PDF-');
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe('Breakfast Meeting submissions');
    const { width, height } = loaded.getPage(0).getSize();
    expect(height).toBeGreaterThan(width);
  });

  it('builds a landscape table PDF when table layout is chosen', async () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: Array.from({ length: 40 }, (_, index) =>
        row(
          String(index + 1),
          `guest${index}@example.com`,
          `2026-09-09T15:${String(index).padStart(2, '0')}:00.000Z`,
          { contactName: `Guest ${index + 1}` },
        ),
      ),
      columns: ['received', 'name', 'email', 'field:attendance'],
      submissionsOnly: true,
    });
    const bytes = await buildSubmissionsExportPdf({
      formName: 'Summer Party',
      mode: 'all',
      table,
      pdfLayout: 'table',
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe('Summer Party submissions');
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    const { width, height } = loaded.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it('keeps a table landscape when many columns are selected', async () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Ada',
        }),
      ],
      columns: [
        'received',
        'name',
        'email',
        'phone',
        'record',
        'field:attendance',
        'field:guests',
      ],
      submissionsOnly: true,
    });
    const bytes = await buildSubmissionsExportPdf({
      formName: 'RSVP',
      mode: 'unique',
      table,
      pdfLayout: 'table',
    });
    const loaded = await PDFDocument.load(bytes);
    const { width, height } = loaded.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('uses stacked portrait sections for the list layout', async () => {
    const table = buildSubmissionExportTable({
      fields: rsvpFields,
      submissions: [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          contactName: 'Ada',
        }),
      ],
      columns: [
        'received',
        'name',
        'email',
        'phone',
        'record',
        'field:attendance',
        'field:guests',
      ],
      submissionsOnly: true,
    });
    const bytes = await buildSubmissionsExportPdf({
      formName: 'RSVP',
      mode: 'unique',
      table,
      pdfLayout: 'list',
      attendeeTotals: countRsvpAttendeeTotals(rsvpFields, [
        row('1', 'ada@example.com', '2026-09-09T15:04:00.000Z', {
          payload: { attendance: 'Yes', guests: '2' },
        }),
      ]),
    });
    const loaded = await PDFDocument.load(bytes);
    const { width, height } = loaded.getPage(0).getSize();
    expect(height).toBeGreaterThan(width);
    expect(loaded.getPageCount()).toBe(1);
  });
});
