import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  applyEpcEnergySection,
  energySectionHtmlFromEpc,
  energySectionPlainText,
} from './energy-section';
import { parseEpcCertificate } from './parse';

const epc = parseEpcCertificate(
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        'fixtures',
        'rdsap-certificate.json',
      ),
      'utf8',
    ),
  ),
  '0000-1672-0000-1732-0000',
)!;

describe('energySectionHtmlFromEpc', () => {
  it('writes a cautious energy paragraph from the attached certificate', () => {
    const text = energySectionPlainText(epc);
    expect(text).toMatch(/band E \(50\)/);
    expect(text).toMatch(/potential band C \(72\)/);
    expect(text).toMatch(/0000-1672-0000-1732-0000/);
    expect(text).toMatch(/55 m²/);
    expect(text).toMatch(/mains gas/i);
    expect(text).toMatch(/has not reassessed energy performance/);

    const html = energySectionHtmlFromEpc(epc);
    expect(html).toContain('<p>');
    expect(html).toContain('12 Example Street');
  });
});

describe('applyEpcEnergySection', () => {
  it('fills an empty energy slot and leaves existing copy alone', () => {
    const empty = applyEpcEnergySection(
      {
        version: 1,
        blocks: [
          {
            id: 'h',
            type: 'heading',
            text: 'Energy efficiency rating',
            level: 2,
            sectionKey: 'energy_efficiency_rating',
          },
          { id: 't', type: 'text', html: '<p></p>' },
        ],
      },
      energySectionHtmlFromEpc(epc),
    );
    expect(empty.blocks[1]).toMatchObject({ type: 'text' });
    if (empty.blocks[1]?.type === 'text') {
      expect(empty.blocks[1].html).toContain('band E');
    }

    const kept = applyEpcEnergySection(
      {
        version: 1,
        blocks: [
          {
            id: 'h',
            type: 'heading',
            text: 'Energy efficiency rating',
            level: 2,
            sectionKey: 'energy_efficiency_rating',
          },
          {
            id: 't',
            type: 'text',
            html: '<p>Surveyor already wrote this.</p>',
          },
        ],
      },
      energySectionHtmlFromEpc(epc),
    );
    if (kept.blocks[1]?.type === 'text') {
      expect(kept.blocks[1].html).toContain('Surveyor already wrote this');
    }
  });

  it('falls back to the legacy energy heading when C.epc is absent', () => {
    const filled = applyEpcEnergySection(
      {
        version: 1,
        blocks: [
          {
            id: 'h',
            type: 'heading',
            text: 'Energy efficiency',
            level: 2,
            sectionKey: 'energy',
          },
          { id: 't', type: 'text', html: '<p></p>' },
        ],
      },
      energySectionHtmlFromEpc(epc),
    );
    if (filled.blocks[1]?.type === 'text') {
      expect(filled.blocks[1].html).toContain('band E');
    }
  });
});
