import { describe, expect, it } from 'vitest';

import {
  parseBrackettsRequirementsCsv,
  requirementSectorLabel,
} from './bracketts-requirements-import';

const SAMPLE = `
,,,,,Class B (Industrial),,,,,,,,,
,,,,,"Class E (Retail, Offices)",,,,,,,,,
,,,,,Land,,,,,,,,,
Date ,Company,Contact name ,Tel ,Email ,Use ,FH / LH,Size Requirement ,LOCATION ,Details sent ,Notes
28/07/2026,Location Coordinator ,Phoebe,07786 642 274 ,phoebelocations@gmail.com,CAFE SITE FOR EAT N MESS,OPEN,OPEN ,Think accessible,,expansion
14/07/2026,DCS Roofing Ltd,James Smith,7758288366,j.smith@dcsroofingltd.co.uk,Industrial,LH,,Yalding,No,General enquiry
14/07/2026,Fernfield Homes,Chris Sparks,1634470502,,Development,FH,,,Hop pole,
`.trim();

describe('parseBrackettsRequirementsCsv', () => {
  it('maps use classes and contact fields', () => {
    const rows = parseBrackettsRequirementsCsv(SAMPLE);
    expect(rows.length).toBe(3);

    const cafe = rows.find((r) => r.contactName === 'Phoebe')!;
    expect(cafe.useClass).toBe('class_e');
    expect(cafe.email).toBe('phoebelocations@gmail.com');
    expect(requirementSectorLabel(cafe)).toBe('Retail / Offices');

    const industrial = rows.find((r) => r.companyName === 'DCS Roofing Ltd')!;
    expect(industrial.useClass).toBe('class_b');
    expect(industrial.tenure).toBe('rent');

    const development = rows.find((r) => r.companyName === 'Fernfield Homes')!;
    expect(development.useClass).toBe('development');
    expect(development.tenure).toBe('buy');
  });
});
