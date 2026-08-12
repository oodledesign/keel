import { describe, expect, it } from 'vitest';

import { buildTaskNotesFromSource } from './build-task-notes-from-source';

describe('buildTaskNotesFromSource', () => {
  it('uses description alone when no excerpt', () => {
    expect(
      buildTaskNotesFromSource({
        description: 'Send the contract by Friday',
        sourceExcerpt: null,
        sourceLabel: 'Email',
      }),
    ).toBe('Send the contract by Friday');
  });

  it('uses excerpt alone when description is empty', () => {
    expect(
      buildTaskNotesFromSource({
        description: null,
        sourceExcerpt: 'Please send the quote by Friday',
        sourceLabel: 'Email',
      }),
    ).toBe('Email excerpt: "Please send the quote by Friday"');
  });

  it('combines description and excerpt when both differ', () => {
    expect(
      buildTaskNotesFromSource({
        description: 'Follow up with Sarah',
        sourceExcerpt: 'Sarah will send the contract by Friday',
        sourceLabel: 'Meeting',
      }),
    ).toBe(
      'Follow up with Sarah\n\nMeeting excerpt: "Sarah will send the contract by Friday"',
    );
  });

  it('does not duplicate when description matches excerpt', () => {
    expect(
      buildTaskNotesFromSource({
        description: 'Same text',
        sourceExcerpt: 'Same text',
        sourceLabel: 'Email',
      }),
    ).toBe('Same text');
  });

  it('returns null when both empty', () => {
    expect(
      buildTaskNotesFromSource({
        description: '  ',
        sourceExcerpt: null,
      }),
    ).toBeNull();
  });
});
