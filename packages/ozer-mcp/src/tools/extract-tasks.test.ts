import { describe, expect, it } from 'vitest';

import { resolveMcpCreateDurationMinutes } from './duration';
import { extractTasksSchema } from './extract-tasks';

describe('extract_tasks duration schema', () => {
  it('accepts optional duration_minutes on items and subtasks', () => {
    expect(
      extractTasksSchema.parse({
        mode: 'dry_run',
        tasks: [
          {
            title: 'Write homepage',
            duration_minutes: 90,
            subtasks: [{ title: 'Quick email', duration_minutes: 15 }],
          },
        ],
      }),
    ).toMatchObject({
      tasks: [
        {
          title: 'Write homepage',
          duration_minutes: 90,
          subtasks: [{ title: 'Quick email', duration_minutes: 15 }],
        },
      ],
    });
  });

  it('allows omitting duration_minutes so the server can estimate', () => {
    const parsed = extractTasksSchema.parse({
      text: '- Review the brand deck',
    });

    expect(parsed.tasks).toBeUndefined();
    expect(parsed.text).toBe('- Review the brand deck');
  });
});

describe('extract_tasks duration resolution', () => {
  it('estimates from the title when duration_minutes is omitted', () => {
    expect(
      resolveMcpCreateDurationMinutes({ title: 'Review the brand deck' }),
    ).toBe(45);
  });

  it('preserves explicit duration_minutes from the structured input', () => {
    expect(
      resolveMcpCreateDurationMinutes({
        title: 'Review the brand deck',
        duration_minutes: 120,
      }),
    ).toBe(120);
  });

  it('treats null duration_minutes as absent and estimates', () => {
    expect(
      resolveMcpCreateDurationMinutes({
        title: 'Review the brand deck',
        duration_minutes: null,
      }),
    ).toBe(45);
  });
});
