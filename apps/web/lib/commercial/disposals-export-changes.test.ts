import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_OPTIONS,
  buildDisposalsExportTable,
  buildExportSnapshot,
  renderExportHtml,
  toTextTable,
} from './disposals-export';
import {
  SESSION_WINDOW_MS,
  type Snapshot,
  chooseBaseline,
  describeFieldChanges,
  diffSnapshots,
  hasChanges,
  summariseChanges,
} from './disposals-export-changes';
import { renderReportEmailBody } from './disposals-report-email';
import {
  ReportScheduleInputSchema,
  describeSchedule,
  isReportDue,
  londonClock,
} from './disposals-report-schedule';
import type { DisposalsScheduleInput } from './disposals-schedule';

function listing(over: Record<string, unknown>) {
  return {
    status: 'marketing',
    disposal_type: 'to_let',
    town: 'Tunbridge Wells',
    account_branch_id: 'tw',
    ...over,
  };
}

function input(listings: Array<Record<string, unknown>>) {
  return {
    listings,
    units: [],
    agents: [],
    coAgents: [],
    parties: [],
    memberNames: new Map(),
    branchNames: new Map([['tw', 'Tunbridge Wells']]),
    clientNames: new Map(),
  } as unknown as DisposalsScheduleInput;
}

const OPTIONS = { ...DEFAULT_EXPORT_OPTIONS, compareToLast: true };
const NOW = '2027-01-10T09:00:00.000Z';

const BEFORE = input([
  listing({ id: 'a', address_line_1: '1 A Road', asking_rent_pence: 2000000 }),
  listing({ id: 'b', address_line_1: '2 B Road', asking_rent_pence: 1000000 }),
  listing({ id: 'c', address_line_1: '3 C Road', asking_rent_pence: 500000 }),
]);

const AFTER = input([
  // a: rent changed
  listing({ id: 'a', address_line_1: '1 A Road', asking_rent_pence: 2200000 }),
  // b: unchanged
  listing({ id: 'b', address_line_1: '2 B Road', asking_rent_pence: 1000000 }),
  // c: now let, so off the default list
  listing({
    id: 'c',
    status: 'let',
    address_line_1: '3 C Road',
    asking_rent_pence: 500000,
  }),
  // d: new
  listing({ id: 'd', address_line_1: '4 D Road', asking_rent_pence: 750000 }),
]);

function baselineFrom(source: DisposalsScheduleInput) {
  return {
    takenAt: NOW,
    rows: buildExportSnapshot(source, OPTIONS),
  };
}

describe('diffSnapshots', () => {
  it('finds new, changed and departed disposals', () => {
    const baseline = baselineFrom(BEFORE);
    const current = buildExportSnapshot(AFTER, OPTIONS);
    const changes = diffSnapshots(baseline, current, () => 'Let');

    expect([...changes.newIds]).toEqual(['d']);
    expect([...changes.changedById.keys()]).toEqual(['a']);
    expect(changes.removed.map((row) => row.id)).toEqual(['c']);
    expect(summariseChanges(changes)).toBe('1 new, 1 changed, 1 left the list');
    expect(hasChanges(changes)).toBe(true);
  });

  it('reports no changes for identical snapshots', () => {
    const baseline = baselineFrom(BEFORE);
    const changes = diffSnapshots(
      baseline,
      buildExportSnapshot(BEFORE, OPTIONS),
      () => 'Removed',
    );
    expect(hasChanges(changes)).toBe(false);
    expect(summariseChanges(changes)).toBe('no changes');
  });

  it('ignores case and spacing differences', () => {
    const row = {
      availability: 'To let',
      address: 'x',
      town: 't',
      size: '',
      price: '',
    };
    const changes = diffSnapshots(
      { takenAt: NOW, rows: { a: row } },
      { a: { ...row, town: ' T ' } },
      () => '',
    );
    expect(hasChanges(changes)).toBe(false);
  });

  it('describes a change as from → to', () => {
    const changes = diffSnapshots(
      baselineFrom(BEFORE),
      buildExportSnapshot(AFTER, OPTIONS),
      () => 'Let',
    );
    const text = describeFieldChanges(changes.changedById.get('a') ?? []);
    expect(text).toMatch(/^Rent or price: .*£20,000.* → .*£22,000/);
  });
});

describe('chooseBaseline', () => {
  const snapshot: Snapshot = {};
  const previous: Snapshot = { x: {} as never };

  it('has nothing to compare with on the first export', () => {
    expect(chooseBaseline(null, new Date(NOW))).toEqual({
      baseline: null,
      rollForward: true,
    });
  });

  it('compares with the last export and rolls forward after the session window', () => {
    const now = new Date(new Date(NOW).getTime() + SESSION_WINDOW_MS + 1000);
    const result = chooseBaseline(
      {
        snapshot,
        takenAt: NOW,
        previousSnapshot: previous,
        previousTakenAt: '2027-01-01T00:00:00.000Z',
      },
      now,
    );
    expect(result.rollForward).toBe(true);
    expect(result.baseline?.rows).toBe(snapshot);
  });

  it('keeps the earlier baseline for repeat exports in one session', () => {
    const now = new Date(new Date(NOW).getTime() + 60 * 1000);
    const result = chooseBaseline(
      {
        snapshot,
        takenAt: NOW,
        previousSnapshot: previous,
        previousTakenAt: '2027-01-01T00:00:00.000Z',
      },
      now,
    );
    expect(result.rollForward).toBe(false);
    expect(result.baseline?.rows).toBe(previous);
  });
});

describe('export table in compare mode', () => {
  const baseline = baselineFrom(BEFORE);

  it('adds a Change column, tones and a "no longer on this list" group', () => {
    const table = buildDisposalsExportTable(AFTER, OPTIONS, 'now', {
      baseline,
    });
    expect(table.columns[0]?.label).toBe('Change');
    expect(table.hasChanges).toBe(true);
    expect(table.changeSummary).toBe('1 new, 1 changed, 1 left the list');

    const text = toTextTable(table);
    const tones = text.groups.flatMap((group) => group.tones ?? []);
    expect(tones).toEqual(
      expect.arrayContaining(['new', 'changed', 'removed']),
    );
    expect(text.groups.at(-1)?.label).toBe('No longer on this list');
    expect(text.groups.at(-1)?.rows[0]?.[0]).toBe('Left the list');
    expect(text.groups.at(-1)?.rows[0]?.[1]).toBe('Let');
  });

  it('says so when there is nothing to compare with yet', () => {
    const table = buildDisposalsExportTable(AFTER, OPTIONS, 'now', {
      baseline: null,
    });
    expect(table.changeSummary).toBeNull();
    expect(table.filters.join(' ')).toMatch(/nothing to compare/i);
  });

  it('leaves a plain export untouched', () => {
    const table = buildDisposalsExportTable(AFTER, OPTIONS, 'now');
    expect(table.columns.some((column) => column.label === 'Change')).toBe(
      false,
    );
    expect(table.hasChanges).toBe(false);
  });

  it('colours changed rows in the print view and the email', () => {
    const table = toTextTable(
      buildDisposalsExportTable(AFTER, OPTIONS, 'now', { baseline }),
    );
    expect(renderExportHtml(table)).toContain('tone-new');
    const email = renderReportEmailBody(table, {
      attachmentNames: ['availability.pdf'],
    });
    expect(email).toContain('#dcfce7');
    expect(email).toContain('#fef3c7');
    expect(email).toContain('Since the last report');
    expect(email).toContain('Attached: availability.pdf');
  });

  it('cuts a long email table short and says so', () => {
    const many = input(
      Array.from({ length: 12 }, (_, i) =>
        listing({ id: `l${i}`, address_line_1: `${i} Long Road` }),
      ),
    );
    const table = toTextTable(buildDisposalsExportTable(many, OPTIONS, 'now'));
    const email = renderReportEmailBody(table, {
      attachmentNames: [],
      maxRows: 5,
    });
    expect(email).toContain('Showing the first 5 rows only.');
    expect(email).not.toContain('11 Long Road');
  });
});

describe('scheduling on the UK clock', () => {
  it('reads weekday and hour in London, in summer and winter', () => {
    // Monday 4 Jan 2027, 08:30 GMT
    expect(londonClock(new Date('2027-01-04T08:30:00Z'))).toEqual({
      day: '2027-01-04',
      weekday: 1,
      hour: 8,
    });
    // Monday 5 Jul 2027, 07:30 UTC is 08:30 BST
    expect(londonClock(new Date('2027-07-05T07:30:00Z'))).toEqual({
      day: '2027-07-05',
      weekday: 1,
      hour: 8,
    });
  });

  const base: Parameters<typeof isReportDue>[0] = {
    enabled: true,
    daysOfWeek: [1],
    sendHour: 8,
    lastRunAt: null,
    lastStatus: null,
  };

  it('is due on the right day once the hour has come', () => {
    expect(isReportDue(base, new Date('2027-01-04T08:00:00Z'))).toBe(true);
    expect(isReportDue(base, new Date('2027-01-04T07:00:00Z'))).toBe(false);
    expect(isReportDue(base, new Date('2027-01-05T09:00:00Z'))).toBe(false);
  });

  it('catches up if the cron ran late, but only once a day', () => {
    const late = new Date('2027-01-04T11:00:00Z');
    expect(isReportDue(base, late)).toBe(true);
    expect(
      isReportDue(
        { ...base, lastRunAt: '2027-01-04T08:00:05Z', lastStatus: 'sent' },
        late,
      ),
    ).toBe(false);
    expect(
      isReportDue(
        { ...base, lastRunAt: '2026-12-28T08:00:05Z', lastStatus: 'sent' },
        late,
      ),
    ).toBe(true);
  });

  it('retries a failed run and ignores a skipped one', () => {
    const now = new Date('2027-01-04T10:00:00Z');
    const ran = { ...base, lastRunAt: '2027-01-04T08:00:05Z' };
    expect(isReportDue({ ...ran, lastStatus: 'failed' }, now)).toBe(true);
    expect(isReportDue({ ...ran, lastStatus: 'skipped' }, now)).toBe(false);
  });

  it('never fires when switched off', () => {
    expect(
      isReportDue(
        { ...base, enabled: false },
        new Date('2027-01-04T09:00:00Z'),
      ),
    ).toBe(false);
  });

  it('describes the schedule', () => {
    expect(describeSchedule({ daysOfWeek: [1], sendHour: 8 })).toBe(
      'Mondays at 08:00',
    );
    expect(describeSchedule({ daysOfWeek: [1, 3], sendHour: 9 })).toBe(
      'Mon, Wed at 09:00',
    );
  });
});

describe('report input validation', () => {
  const valid = {
    name: ' Weekly ',
    enabled: true,
    daysOfWeek: [3, 1, 3],
    sendHour: 8,
    recipients: ['Darrell@Example.com', 'darrell@example.com'],
    attachments: ['pdf', 'pdf'],
    onlyWhenChanged: false,
    options: DEFAULT_EXPORT_OPTIONS,
  };

  it('tidies days, recipients and attachments', () => {
    const parsed = ReportScheduleInputSchema.parse(valid);
    expect(parsed.name).toBe('Weekly');
    expect(parsed.daysOfWeek).toEqual([1, 3]);
    expect(parsed.recipients).toEqual(['darrell@example.com']);
    expect(parsed.attachments).toEqual(['pdf']);
  });

  it.each([
    ['no day', { daysOfWeek: [] }],
    ['no recipient', { recipients: [] }],
    ['a bad address', { recipients: ['not-an-email'] }],
    ['an hour past 23', { sendHour: 24 }],
    ['an unknown attachment', { attachments: ['docx'] }],
  ])('rejects %s', (_label, patch) => {
    expect(
      ReportScheduleInputSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  });
});
