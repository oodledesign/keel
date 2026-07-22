import { describe, expect, it } from 'vitest';

import { dedupePlanDocument, parsePlanDocument } from './plan-blocks';

describe('parsePlanDocument deduplication', () => {
  it('drops duplicate calendar events with the same time and title', () => {
    const markdown = `## Today's Plan — Tue 22 Jul

### Morning
9am–9:30am · 📅 Daily Planner
9am–9:30am · 📅 Daily Planner
10am–11am · Write proposal · Oodle · ~60min
`;

    const doc = parsePlanDocument(markdown);
    const blocks = doc.sections.flatMap((section) => section.blocks);

    expect(blocks).toHaveLength(2);
    expect(blocks.filter((block) => block.isCalendarEvent)).toHaveLength(1);
  });

  it('dedupePlanDocument removes blocks with the same google event id', () => {
    const doc = parsePlanDocument(`## Plan

9am–10am · 📅 Team standup
10am–11am · 📅 Team standup
`);

    const withIds = dedupePlanDocument({
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block, index) => ({
          ...block,
          googleEventId: block.isCalendarEvent ? 'evt-1' : null,
          id: `block-${index}`,
        })),
      })),
    });

    expect(withIds.sections.flatMap((section) => section.blocks)).toHaveLength(
      1,
    );
  });
});
