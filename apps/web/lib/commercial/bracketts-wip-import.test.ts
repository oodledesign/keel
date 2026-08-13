import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BRACKETTS_WIP_IMPORT_SOURCE,
  fuzzyListingScore,
  parseBrackettsWipCsvRows,
  parseChaseNotes,
  parseCsvMultiline,
  rankListingMatches,
} from './bracketts-wip-import';

describe('parseChaseNotes', () => {
  it('parses dated lines with authors', () => {
    const notes = parseChaseNotes(
      `18.06 Dt chased for an update

11.06 DT chased
5.06 Job emailed sols`,
      'instr-1',
      2025,
    );
    expect(notes).toHaveLength(3);
    expect(notes[0]?.authorToken).toBe('DT');
    expect(notes[0]?.dateIso?.startsWith('2025-06-18')).toBe(true);
    expect(notes[2]?.authorToken).toBe('JOB');
  });

  it('keeps undated blob as a single note', () => {
    const notes = parseChaseNotes('AML done — wait on LL', 'instr-2');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.authorToken).toBeNull();
    expect(notes[0]?.body).toContain('AML done');
  });
});

describe('parseBrackettsWipCsvRows', () => {
  it('maps billed / under offer / potential and portfolio children', () => {
    const rows = [
      ['', 'AGENCY BILLED', '', ''],
      ['', 'Poundland High Street', '18.06 DT billed', '£11,135'],
      ['', '2026-2027 UNDER OFFER', '', ''],
      ['', 'Unit 8 Deacon', '1.06 AM chased', '£15,897'],
      ['', 'Potential instructions', '', ''],
      ['', 'Santander Pavilion', '2.05 DB called', ''],
      ['', 'Management', '', ''],
      ['', 'Nazeing - Overall', '', ''],
      ['', 'Asbestos', '3.04 Job booked', ''],
      ['', 'EICR', '', ''],
    ];

    const parsed = parseBrackettsWipCsvRows(rows);
    const poundland = parsed.find((p) => p.title.includes('Poundland'))!;
    expect(poundland.stage).toBe('completed_exchanged');
    expect(poundland.workType).toBe('agency');
    expect(poundland.feeGbp).toBe(11135);
    expect(poundland.importKey.startsWith(BRACKETTS_WIP_IMPORT_SOURCE)).toBe(
      true,
    );

    const uo = parsed.find((p) => p.title.includes('Unit 8'))!;
    expect(uo.stage).toBe('under_offer_negotiating');
    expect(uo.chaseNotes[0]?.authorToken).toBe('AM');

    const potential = parsed.find((p) => p.title.includes('Santander'))!;
    expect(potential.stage).toBe('potential');

    const portfolio = parsed.find((p) => p.title.includes('Nazeing'))!;
    expect(portfolio.workType).toBe('management');
    expect(portfolio.childLabels).toEqual(
      expect.arrayContaining(['Asbestos', 'EICR']),
    );
    expect(portfolio.chaseNotes.some((n) => n.authorToken === 'JOB')).toBe(
      true,
    );
  });

  it('parses the real Bracketts CSV when present', () => {
    const path =
      '/Users/danjamespotter/Downloads/250520 Download  - Work In Progress(Sheet1).csv';
    let buf: Buffer;
    try {
      buf = readFileSync(path);
    } catch {
      return;
    }
    const rows = parseCsvMultiline(buf.toString('latin1'));
    const parsed = parseBrackettsWipCsvRows(rows);
    expect(parsed.length).toBeGreaterThan(80);
    expect(parsed.some((p) => p.stage === 'completed_exchanged')).toBe(true);
    expect(parsed.some((p) => p.stage === 'under_offer_negotiating')).toBe(
      true,
    );
  });
});

describe('fuzzy listing match', () => {
  it('scores overlapping address tokens highly', () => {
    expect(
      fuzzyListingScore(
        'Poundland High Street Tonbridge',
        'Poundland, High Street, Tonbridge',
      ),
    ).toBeGreaterThan(0.7);

    const ranked = rankListingMatches('Unit 8 Deacon Industrial Estate HITW', [
      { id: '1', name: 'Unit 8, Deacon Industrial Estate, Higham' },
      { id: '2', name: 'Completely unrelated barn' },
    ]);
    expect(ranked[0]?.id).toBe('1');
    expect(
      fuzzyListingScore(
        'Costa Coffee 23 High Street Tonbridge',
        '150-152 High Street, Tonbridge',
      ),
    ).toBe(0);
  });
});
