import { describe, expect, it } from 'vitest';

import {
  parseRecorderNotesClientFilter,
  parseRecorderNotesListQuery,
  sanitizeRecorderNotesSearch,
} from './list-notes-query';

describe('parseRecorderNotesListQuery', () => {
  it('defaults to the first page of 20 notes', () => {
    expect(parseRecorderNotesListQuery(new URLSearchParams())).toEqual({
      limit: 20,
      offset: 0,
      accountId: null,
      clientId: undefined,
      category: null,
      q: null,
    });
  });

  it('caps the page size and keeps a valid client filter', () => {
    const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const query = parseRecorderNotesListQuery(
      new URLSearchParams({
        limit: '200',
        offset: '25',
        account_id: '  workspace-1  ',
        client_id: clientId,
        category: 'meeting_transcript',
        q: '  roof leak  ',
      }),
    );

    expect(query.limit).toBe(50);
    expect(query.offset).toBe(25);
    expect(query.accountId).toBe('workspace-1');
    expect(query.clientId).toBe(clientId);
    expect(query.category).toBe('meeting_transcript');
    expect(query.q).toBe('roof leak');
  });

  it('treats unassigned as a none filter', () => {
    expect(parseRecorderNotesClientFilter('none')).toBe('none');
    expect(parseRecorderNotesClientFilter('unassigned')).toBe('none');
    expect(parseRecorderNotesClientFilter('not-a-uuid')).toBeUndefined();
  });

  it('strips PostgREST filter characters from search', () => {
    expect(sanitizeRecorderNotesSearch('roof % leak, (urgent)')).toBe(
      'roof leak urgent',
    );
  });
});
