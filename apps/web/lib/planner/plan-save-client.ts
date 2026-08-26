import type { SavePlannerPlanInput, SavePlannerPlanResult } from './save-planner-plan';

export async function savePlannerPlanClient(
  input: SavePlannerPlanInput,
): Promise<SavePlannerPlanResult> {
  const response = await fetch('/api/planner/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as SavePlannerPlanResult & {
    error?: string;
  };

  if (!response.ok) {
    return {
      success: false,
      error: body.error ?? 'Could not save plan',
    };
  }

  return body;
}
