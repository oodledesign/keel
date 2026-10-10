import { describe, expect, it } from 'vitest';

import {
  type Box,
  coverHeadline,
  coverTitleParts,
  fitPhotoBox,
  keepPostcodesTogether,
  layoutPhotoGrid,
  nameInitials,
  parseDetailsBody,
  splitLeadParagraph,
  tidyAddress,
} from '../brochure-layout';

describe('coverHeadline', () => {
  it('pulls the locality up into the title', () => {
    expect(
      coverHeadline({
        title: '10 High Street',
        subtitle: 'Otford, Sevenoaks, Kent TN14 5PQ',
      }),
    ).toEqual({
      title: '10 High Street, Otford',
      subtitle: 'Sevenoaks, Kent TN14 5PQ',
    });
  });

  it('leaves titles alone when the subtitle has no spare locality', () => {
    const postcodeOnly = { title: 'Unit 4', subtitle: 'TN14 5PQ' };
    expect(coverHeadline(postcodeOnly)).toEqual(postcodeOnly);
    const single = { title: 'Unit 4', subtitle: 'Sevenoaks' };
    expect(coverHeadline(single)).toEqual(single);
    const street = { title: 'Unit 4', subtitle: '12 Mill Lane, Sevenoaks' };
    expect(coverHeadline(street)).toEqual(street);
    const commaTitle = {
      title: 'Ground Floor, 4 London Road',
      subtitle: 'Crowborough, East Sussex',
    };
    expect(coverHeadline(commaTitle)).toEqual(commaTitle);
  });
});

describe('splitLeadParagraph', () => {
  it('uses the first paragraph when there are several', () => {
    expect(splitLeadParagraph('Opening line here.\n\nMore detail.')).toEqual({
      lead: 'Opening line here.',
      rest: 'More detail.',
    });
  });

  it('uses the first sentence of a single long paragraph', () => {
    const body =
      'A rare opportunity to secure offices in the village centre. Suites range from 72 sq ft up to 1,146 sq ft with shared facilities.';
    expect(splitLeadParagraph(body)).toEqual({
      lead: 'A rare opportunity to secure offices in the village centre.',
      rest: 'Suites range from 72 sq ft up to 1,146 sq ft with shared facilities.',
    });
  });

  it('skips the lead for short copy', () => {
    expect(splitLeadParagraph('Small shop. Good footfall.')).toEqual({
      lead: '',
      rest: 'Small shop. Good footfall.',
    });
  });
});

describe('nameInitials', () => {
  it('takes first and last initials', () => {
    expect(nameInitials('Dominic Tomlinson')).toBe('DT');
    expect(nameInitials('Mary Jane van der Berg')).toBe('MB');
    expect(nameInitials('Cher')).toBe('C');
    expect(nameInitials('  ')).toBe('');
  });
});

const AREA: Box = { x: 0, y: 0, width: 800, height: 500 };

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width - 0.01 &&
    b.x < a.x + a.width - 0.01 &&
    a.y < b.y + b.height - 0.01 &&
    b.y < a.y + a.height - 0.01
  );
}

function inside(box: Box, area: Box) {
  return (
    box.x >= area.x - 0.01 &&
    box.y >= area.y - 0.01 &&
    box.x + box.width <= area.x + area.width + 0.01 &&
    box.y + box.height <= area.y + area.height + 0.01
  );
}

describe('address helpers', () => {
  it('keeps UK postcodes on one line', () => {
    expect(keepPostcodesTogether('Kent TN14 5PQ')).toBe('Kent TN14\u00a05PQ');
  });

  it('drops the comma before a trailing postcode', () => {
    expect(tidyAddress(', Otford, Sevenoaks, Kent, TN14 5PQ')).toBe(
      'Otford, Sevenoaks, Kent TN14 5PQ',
    );
  });

  it('splits the cover title from the address without repeating it', () => {
    expect(
      coverTitleParts(
        '10 High Street, Sevenoaks, TN14 5PQ',
        '10 High Street, Otford, Sevenoaks, Kent, TN14 5PQ',
      ),
    ).toEqual({
      title: '10 High Street',
      subtitle: 'Otford, Sevenoaks, Kent TN14 5PQ',
    });
  });

  it('keeps a distinct building name as the title', () => {
    expect(
      coverTitleParts('The Crown', '10 High Street, Otford, TN14 5PQ'),
    ).toEqual({
      title: 'The Crown',
      subtitle: '10 High Street, Otford TN14 5PQ',
    });
  });
});

describe('parseDetailsBody', () => {
  it('reads headings, bullets and paragraphs', () => {
    expect(
      parseDetailsBody('## Specification\n- Kitchen\n• WCs\n\nPlain text.'),
    ).toEqual([
      { kind: 'heading', text: 'Specification' },
      { kind: 'bullet', text: 'Kitchen' },
      { kind: 'bullet', text: 'WCs' },
      { kind: 'paragraph', text: 'Plain text.' },
    ]);
  });
});

describe('fitPhotoBox', () => {
  it('shrinks the frame instead of letterboxing a wide photo', () => {
    const box = fitPhotoBox(2, AREA, { maxCrop: 0 });
    expect(box.width).toBe(800);
    expect(box.height).toBe(400);
    expect(inside(box, AREA)).toBe(true);
  });

  it('fills the area when the crop allowance covers the difference', () => {
    const box = fitPhotoBox(1.5, AREA, { maxCrop: 0.2 });
    expect(box).toEqual(AREA);
  });

  it('pins the frame to the top when asked', () => {
    const box = fitPhotoBox(4, AREA, { maxCrop: 0, align: 'top' });
    expect(box.y + box.height).toBe(AREA.height);
  });
});

describe('layoutPhotoGrid', () => {
  it.each([[[1.5, 1.5]], [[0.75, 1.5]], [[1.5, 0.75, 1.33]]])(
    'lays %j out inside the area without overlaps',
    (aspects) => {
      const boxes = layoutPhotoGrid(aspects, AREA, { gap: 10 });
      expect(boxes).toHaveLength(aspects.length);
      for (const box of boxes) expect(inside(box, AREA)).toBe(true);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
        }
      }
    },
  );

  it('keeps reading order left-to-right for side-by-side photos', () => {
    const [a, b] = layoutPhotoGrid([0.75, 0.75], AREA, { gap: 10 });
    expect(a!.x).toBeLessThan(b!.x);
  });

  it('returns nothing for unsupported counts', () => {
    expect(layoutPhotoGrid([], AREA)).toEqual([]);
    expect(layoutPhotoGrid([1, 1, 1, 1], AREA)).toEqual([]);
  });
});
