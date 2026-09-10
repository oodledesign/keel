import { describe, expect, it } from 'vitest';

import { parseExtractText, shouldAutoLink } from './extract-text';

describe('parseExtractText', () => {
  it('parses bullets, nested subtasks, due dates, and client context', () => {
    const parsed = parseExtractText(`
Client: Bracketts
Project: Shopfront
- Send invoice due 2026-09-12 [high]
  - Attach timesheet
  - CC Dan
- Chase artwork — waiting on revised logo
`);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      title: 'Send invoice',
      due_date: '2026-09-12',
      priority: 'high',
      suggested_client_name: 'Bracketts',
      suggested_project_name: 'Shopfront',
    });
    expect(parsed[0]?.subtasks.map((row) => row.title)).toEqual([
      'Attach timesheet',
      'CC Dan',
    ]);
    expect(parsed[1]).toMatchObject({
      title: 'Chase artwork',
      notes: 'waiting on revised logo',
      suggested_client_name: 'Bracketts',
    });
  });

  it('treats a single unbulleted line as one root task', () => {
    expect(
      parseExtractText('Call Oodle about the proposal due 2026-10-01'),
    ).toEqual([
      {
        title: 'Call Oodle about the proposal',
        notes: null,
        due_date: '2026-10-01',
        priority: 'medium',
        suggested_client_name: null,
        suggested_project_name: null,
        subtasks: [],
      },
    ]);
  });
});

describe('shouldAutoLink', () => {
  it('links explicit ids and high-confidence matches only', () => {
    expect(
      shouldAutoLink({ explicitId: 'abc', acceptSuggestions: false }),
    ).toBe(true);
    expect(
      shouldAutoLink({ confidence: 'high', acceptSuggestions: false }),
    ).toBe(true);
    expect(
      shouldAutoLink({ confidence: 'medium', acceptSuggestions: false }),
    ).toBe(false);
    expect(
      shouldAutoLink({ confidence: 'medium', acceptSuggestions: true }),
    ).toBe(true);
  });
});
