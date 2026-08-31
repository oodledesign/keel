import type { SupabaseClient } from '@supabase/supabase-js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMetaDataDeletionService } from './data-deletion.service';

type QueryResult = { data: unknown; error: { message: string } | null };

function createThenable<T extends object>(value: T, result: QueryResult) {
  return Object.assign(value, {
    then(
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
  });
}

function createMockClient() {
  const igAccounts: Array<{ id: string; ig_business_account_id: string }> = [];
  const commentEvents: Array<{
    id: string;
    commenter_ig_id: string | null;
    commenter_username: string | null;
    comment_text: string | null;
  }> = [];
  const socialAccounts: Array<{
    id: string;
    provider: string;
    platform: string;
    platform_user_id: string;
    external_account_id: string;
  }> = [];
  const deletionRequests: Array<Record<string, unknown>> = [];

  function publicFrom(table: string) {
    if (table === 'meta_data_deletion_requests') {
      return {
        insert(row: Record<string, unknown>) {
          deletionRequests.push({ ...row });
          return Promise.resolve({ data: row, error: null });
        },
        update(row: Record<string, unknown>) {
          return createThenable(
            {
              eq(column: string, value: string) {
                const match = deletionRequests.find(
                  (item) => item[column] === value,
                );
                if (match) {
                  Object.assign(match, row);
                }
                return Promise.resolve({ data: match ?? null, error: null });
              },
            },
            { data: null, error: null },
          );
        },
        select() {
          return {
            eq(column: string, value: string) {
              return {
                maybeSingle() {
                  const match = deletionRequests.find(
                    (item) => item[column] === value,
                  );
                  return Promise.resolve({
                    data: match ?? null,
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    }

    if (table === 'ig_connected_accounts') {
      let filterId: string | null = null;
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              filterId = value;
              return Promise.resolve({
                data: igAccounts.filter(
                  (row) => row.ig_business_account_id === value,
                ),
                error: null,
              });
            },
          };
        },
        delete() {
          return {
            in(_column: string, ids: string[]) {
              const before = igAccounts.length;
              for (let i = igAccounts.length - 1; i >= 0; i -= 1) {
                if (ids.includes(igAccounts[i]!.id)) {
                  igAccounts.splice(i, 1);
                }
              }
              return Promise.resolve({
                data: null,
                error: null,
                deleted: before - igAccounts.length,
              });
            },
            eq(_column: string, value: string) {
              filterId = value;
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        filterId,
      };
    }

    if (table === 'ig_comment_events') {
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return Promise.resolve({
                data: commentEvents.filter(
                  (row) => row.commenter_ig_id === value,
                ),
                error: null,
              });
            },
          };
        },
        update(row: Record<string, unknown>) {
          return {
            in(_column: string, ids: string[]) {
              for (const event of commentEvents) {
                if (ids.includes(event.id)) {
                  Object.assign(event, row);
                }
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    }

    throw new Error(`Unexpected public table ${table}`);
  }

  function feedflowFrom(table: string) {
    if (table !== 'social_accounts') {
      throw new Error(`Unexpected feedflow table ${table}`);
    }

    let filterColumn: string | null = null;
    let filterValue: string | null = null;

    return createThenable(
      {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          filterColumn = column;
          filterValue = value;
          const data = socialAccounts.filter((row) => {
            if (column === 'platform_user_id') {
              return row.platform_user_id === value;
            }
            if (column === 'external_account_id') {
              return row.external_account_id === value;
            }
            return false;
          });
          return createThenable(this, { data, error: null });
        },
        delete() {
          return this;
        },
        in(_column: string, ids: string[]) {
          for (let i = socialAccounts.length - 1; i >= 0; i -= 1) {
            if (ids.includes(socialAccounts[i]!.id)) {
              socialAccounts.splice(i, 1);
            }
          }
          return Promise.resolve({ data: null, error: null });
        },
        filterColumn,
        filterValue,
      },
      { data: [], error: null },
    );
  }

  const client = {
    from: vi.fn((table: string) => publicFrom(table)),
    schema: vi.fn(() => ({
      from: (table: string) => feedflowFrom(table),
    })),
    igAccounts,
    commentEvents,
    socialAccounts,
    deletionRequests,
  };

  return client;
}

describe('createMetaDataDeletionService', () => {
  let mock: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mock = createMockClient();
  });

  it('deletes matching Instagram connections and logs a processed request', async () => {
    mock.igAccounts.push({
      id: 'ig-1',
      ig_business_account_id: '17841400000000000',
    });
    mock.socialAccounts.push({
      id: 'ff-1',
      provider: 'instagram',
      platform: 'instagram',
      platform_user_id: '17841400000000000',
      external_account_id: '17841400000000000',
    });
    mock.socialAccounts.push({
      id: 'ff-tiktok',
      provider: 'tiktok',
      platform: 'tiktok',
      platform_user_id: 'tt-open-id',
      external_account_id: 'tt-open-id',
    });
    mock.commentEvents.push({
      id: 'ev-1',
      commenter_ig_id: '17841400000000000',
      commenter_username: 'someone',
      comment_text: 'hello',
    });

    const service = createMetaDataDeletionService(
      mock as unknown as SupabaseClient,
    );
    const result = await service.processForMetaUser(
      '17841400000000000',
      'abc123',
    );

    expect(result).toMatchObject({
      confirmationCode: 'abc123',
      status: 'processed',
      deletedIgConnections: 1,
      deletedFeedflowAccounts: 1,
      anonymisedCommentEvents: 1,
    });
    expect(mock.igAccounts).toHaveLength(0);
    expect(mock.socialAccounts.map((row) => row.id)).toEqual(['ff-tiktok']);
    expect(mock.commentEvents[0]).toMatchObject({
      commenter_ig_id: null,
      commenter_username: null,
      comment_text: null,
    });
    expect(mock.deletionRequests[0]).toMatchObject({
      confirmation_code: 'abc123',
      status: 'processed',
    });
  });

  it('still records a processed request when nothing matches', async () => {
    const service = createMetaDataDeletionService(
      mock as unknown as SupabaseClient,
    );
    const result = await service.processForMetaUser('unknown-user', 'code-1');

    expect(result.status).toBe('processed');
    expect(result.deletedIgConnections).toBe(0);
    expect(result.deletedFeedflowAccounts).toBe(0);
    expect(mock.deletionRequests[0]).toMatchObject({
      confirmation_code: 'code-1',
      status: 'processed',
    });
  });

  it('looks up a request by confirmation code', async () => {
    const service = createMetaDataDeletionService(
      mock as unknown as SupabaseClient,
    );
    await service.processForMetaUser('unknown-user', 'look-me-up');

    const found = await service.getByConfirmationCode('look-me-up');
    expect(found?.confirmation_code).toBe('look-me-up');
    expect(found?.status).toBe('processed');
  });
});
