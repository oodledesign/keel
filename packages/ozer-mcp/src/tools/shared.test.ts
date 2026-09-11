import { describe, expect, it } from 'vitest';

import {
  isMissingColumnError,
  missingColumnName,
  writeWithOptionalColumns,
} from './shared';

describe('missing column helpers', () => {
  it('parses Postgres and PostgREST missing-column messages', () => {
    const postgres = {
      message: 'column "industry" of relation "contacts" does not exist',
    };
    const postgrest = {
      message: `Could not find the 'project_id' column of 'meeting_transcripts' in the schema cache`,
    };

    expect(isMissingColumnError(postgres)).toBe(true);
    expect(missingColumnName(postgres)).toBe('industry');
    expect(missingColumnName(postgrest)).toBe('project_id');
  });
});

describe('writeWithOptionalColumns', () => {
  it('retries after stripping a missing column', async () => {
    const attempts: Array<Record<string, unknown>> = [];

    const result = await writeWithOptionalColumns(
      async (row) => {
        attempts.push({ ...row });
        if ('industry' in row) {
          return {
            data: null,
            error: {
              message:
                'column "industry" of relation "contacts" does not exist',
            },
          };
        }

        return { data: { id: '1', ...row }, error: null };
      },
      { full_name: 'Jane', industry: 'Retail' },
      'create contact',
    );

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual({ full_name: 'Jane' });
    expect(result).toMatchObject({ id: '1', full_name: 'Jane' });
  });
});
