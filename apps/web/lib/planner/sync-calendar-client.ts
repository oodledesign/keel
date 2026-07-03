import type {
  PlannerSyncBlock,
  PlannerSyncResultMapping,
} from './plan-calendar-sync';

export type PlannerSyncResponse = {
  created: number;
  updated: number;
  errors: string[];
  mappings: PlannerSyncResultMapping[];
};

export async function syncPlannerCalendarBlocks(input: {
  date: string;
  blocks: PlannerSyncBlock[];
}): Promise<PlannerSyncResponse> {
  const response = await fetch('/api/planner/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as PlannerSyncResponse & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? 'Could not sync to Google Calendar');
  }

  return body;
}
