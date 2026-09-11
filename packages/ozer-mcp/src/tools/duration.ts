import { estimateTaskDurationMinutes } from '@kit/tasks/estimate-duration';

/**
 * MCP create paths always persist a duration. Callers may omit
 * `duration_minutes`; the server estimates from title/notes.
 * Update/patch paths must not use this helper.
 */
export function resolveMcpCreateDurationMinutes(input: {
  duration_minutes?: number | null;
  title: string;
  notes?: string | null;
}): number {
  return (
    input.duration_minutes ??
    estimateTaskDurationMinutes({
      title: input.title,
      notes: input.notes,
    })
  );
}
