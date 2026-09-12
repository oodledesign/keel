import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  mergeNativeTaskReviewCounts,
  parseNativeTaskReviewDue,
  parseNativeTaskReviewId,
  parseNativeTaskReviewSource,
  sortNativeTaskReviewItems,
  toNativeEmailReviewItem,
  toNativeMeetingReviewItem,
  unwrapJoinedRow,
} from './task-review-shared';

describe('parseNativeTaskReviewSource', () => {
  it('defaults to all and accepts aliases', () => {
    expect(parseNativeTaskReviewSource(undefined)).toBe('all');
    expect(parseNativeTaskReviewSource('')).toBe('all');
    expect(parseNativeTaskReviewSource('meeting')).toBe('meeting');
    expect(parseNativeTaskReviewSource('meetings')).toBe('meeting');
    expect(parseNativeTaskReviewSource('email')).toBe('email');
    expect(parseNativeTaskReviewSource('emails')).toBe('email');
  });

  it('rejects junk', () => {
    expect(() => parseNativeTaskReviewSource('slack')).toThrow(NativeHttpError);
  });
});

describe('parseNativeTaskReviewDue', () => {
  it('accepts YYYY-MM-DD, blank, and omit', () => {
    expect(parseNativeTaskReviewDue(undefined)).toBeUndefined();
    expect(parseNativeTaskReviewDue(null)).toBeNull();
    expect(parseNativeTaskReviewDue('')).toBeNull();
    expect(parseNativeTaskReviewDue('2026-09-12')).toBe('2026-09-12');
  });

  it('rejects junk', () => {
    expect(() => parseNativeTaskReviewDue('12/09/2026')).toThrow(
      NativeHttpError,
    );
  });
});

describe('parseNativeTaskReviewId', () => {
  it('requires a uuid', () => {
    expect(
      parseNativeTaskReviewId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(() => parseNativeTaskReviewId('nope')).toThrow(NativeHttpError);
  });
});

describe('unwrapJoinedRow', () => {
  it('unwraps arrays and objects', () => {
    expect(unwrapJoinedRow(null)).toBeNull();
    expect(unwrapJoinedRow({ title: 'Site' })).toEqual({ title: 'Site' });
    expect(unwrapJoinedRow([{ title: 'Site' }])).toEqual({ title: 'Site' });
  });
});

describe('toNativeMeetingReviewItem', () => {
  it('maps a pending meeting suggestion for the phone', () => {
    expect(
      toNativeMeetingReviewItem({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        suggested_title: 'Send the quote',
        suggested_description: 'Hope asked for numbers',
        suggested_due_date: '2026-09-15',
        suggested_duration_minutes: 30,
        source_excerpt: 'Can you send the quote tomorrow?',
        created_at: '2026-09-12T10:00:00.000Z',
        meeting_transcripts: {
          title: 'Hope catch-up',
          meeting_date: '2026-09-11',
          client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          clients: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            display_name: 'Hope House',
            company_name: 'Hope House',
            first_name: null,
            last_name: null,
            client_type: 'business',
          },
        },
      }),
    ).toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      source: 'meeting',
      title: 'Send the quote',
      detail: 'Hope asked for numbers',
      snippet: 'Can you send the quote tomorrow?',
      due: '2026-09-15',
      duration_minutes: 30,
      client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      client_name: 'Hope House',
      project_id: null,
      project_name: null,
      context_title: 'Hope catch-up',
      context_date: '2026-09-11',
      created_at: '2026-09-12T10:00:00.000Z',
    });
  });
});

describe('toNativeEmailReviewItem', () => {
  it('maps a suggested email task and falls back to the thread', () => {
    expect(
      toNativeEmailReviewItem({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: 'Reply to invoice query',
        detail: 'Confirm the extra day rate',
        source_excerpt: 'Please confirm the extra day.',
        suggested_due_date: '2026-09-13',
        suggested_duration_minutes: 15,
        created_at: '2026-09-12T09:00:00.000Z',
        client_id: null,
        project_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        clients: null,
        email_threads: {
          subject: 'Re: Site extras',
          last_message_at: '2026-09-12T08:30:00.000Z',
          client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          project_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        },
        projects: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Barn' },
      }),
    ).toEqual({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      source: 'email',
      title: 'Reply to invoice query',
      detail: 'Confirm the extra day rate',
      snippet: 'Please confirm the extra day.',
      due: '2026-09-13',
      duration_minutes: 15,
      client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      client_name: null,
      project_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      project_name: 'Barn',
      context_title: 'Re: Site extras',
      context_date: '2026-09-12T08:30:00.000Z',
      created_at: '2026-09-12T09:00:00.000Z',
    });
  });
});

describe('sortNativeTaskReviewItems', () => {
  it('sorts newest first', () => {
    const sorted = sortNativeTaskReviewItems([
      {
        id: 'a',
        source: 'email',
        title: 'Older',
        detail: null,
        snippet: null,
        due: null,
        duration_minutes: null,
        client_id: null,
        client_name: null,
        project_id: null,
        project_name: null,
        context_title: 'Email',
        context_date: null,
        created_at: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'b',
        source: 'meeting',
        title: 'Newer',
        detail: null,
        snippet: null,
        due: null,
        duration_minutes: null,
        client_id: null,
        client_name: null,
        project_id: null,
        project_name: null,
        context_title: 'Meeting',
        context_date: null,
        created_at: '2026-09-12T10:00:00.000Z',
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('mergeNativeTaskReviewCounts', () => {
  it('adds meeting and email pending counts', () => {
    expect(mergeNativeTaskReviewCounts(2, 3)).toEqual({
      meeting_count: 2,
      email_count: 3,
      pending_count: 5,
    });
  });
});
