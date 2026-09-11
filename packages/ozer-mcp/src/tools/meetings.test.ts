import { describe, expect, it } from 'vitest';

import { clipMeetingContent, meetingExcerpt, meetingTitle } from './meetings';

describe('meetingTitle', () => {
  it('falls back when the stored title is blank', () => {
    expect(meetingTitle({ id: '1', title: '  Weekly sync  ' })).toBe(
      'Weekly sync',
    );
    expect(meetingTitle({ id: '2', title: '   ' })).toBe('Meeting transcript');
  });
});

describe('meetingExcerpt', () => {
  it('collapses whitespace and truncates long transcripts', () => {
    expect(meetingExcerpt('Hello\n\nworld')).toBe('Hello world');
    expect(meetingExcerpt('x'.repeat(400))?.endsWith('…')).toBe(true);
  });
});

describe('clipMeetingContent', () => {
  it('flags oversized transcripts without dropping the start', () => {
    const clipped = clipMeetingContent('y'.repeat(90_000));
    expect(clipped.truncated).toBe(true);
    expect(clipped.content.startsWith('yyy')).toBe(true);
    expect(clipped.content).toHaveLength(80_000);
    expect(clipMeetingContent('short')).toEqual({
      content: 'short',
      truncated: false,
    });
  });
});
