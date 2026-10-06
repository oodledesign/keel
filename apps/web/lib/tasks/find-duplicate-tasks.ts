import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type TypeSafeChoiceQuestion,
  askTypeSafe,
  isTypeSafeConfigured,
} from '~/lib/ai/typesafe';

/** Existing tasks sent to Jev per client/project scope (newest first). */
const MAX_EXISTING_TASKS = 80;
const MAX_NOTES_CHARS = 200;
/** Minimum probability + confidence before a candidate is treated as a duplicate. */
const DUPLICATE_MIN_PROBABILITY = 0.6;
const DUPLICATE_MIN_CONFIDENCE = 0.5;
const NONE_OPTION = 'none';

export type DuplicateCandidate = {
  /** Caller's key, returned in the result map. */
  key: string;
  title: string;
  notes?: string | null;
  clientId: string | null;
  projectId: string | null;
};

export type DuplicateMatch = {
  existingTaskId: string;
  existingTitle: string;
};

type ExistingTask = { id: string; title: string; notes: string | null };

function scopeKey(c: { clientId: string | null; projectId: string | null }) {
  return `${c.clientId ?? ''}|${c.projectId ?? ''}`;
}

async function loadExistingTasks(
  admin: SupabaseClient,
  accountId: string,
  scope: { clientId: string | null; projectId: string | null },
): Promise<ExistingTask[]> {
  const filters: string[] = [];

  if (scope.projectId) {
    filters.push(`project_id.eq.${scope.projectId}`);
  }

  if (scope.clientId) {
    filters.push(`client_id.eq.${scope.clientId}`);
  }

  if (filters.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from('tasks')
    .select('id, title, notes')
    .eq('account_id', accountId)
    .or(filters.join(','))
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
    .limit(MAX_EXISTING_TASKS);

  if (error || !data) {
    return [];
  }

  return (data as ExistingTask[]).filter((task) => task.title?.trim());
}

/**
 * Find extracted tasks that already exist on the same client or project.
 * One Jev request per scope, one Choice question per candidate (pick the
 * matching existing task or "none"). Fails open: on any error or without a
 * TypeSafe key, nothing is reported as a duplicate.
 */
export async function findDuplicateTasks(input: {
  admin: SupabaseClient;
  accountId: string;
  candidates: DuplicateCandidate[];
}): Promise<Map<string, DuplicateMatch>> {
  const duplicates = new Map<string, DuplicateMatch>();

  if (!isTypeSafeConfigured() || input.candidates.length === 0) {
    return duplicates;
  }

  const byScope = new Map<string, DuplicateCandidate[]>();

  for (const candidate of input.candidates) {
    if (!candidate.clientId && !candidate.projectId) {
      continue;
    }

    const key = scopeKey(candidate);
    byScope.set(key, [...(byScope.get(key) ?? []), candidate]);
  }

  await Promise.all(
    [...byScope.values()].map(async (group) => {
      try {
        const first = group[0]!;
        const existing = await loadExistingTasks(
          input.admin,
          input.accountId,
          first,
        );

        if (existing.length === 0) {
          return;
        }

        const existingState: Record<string, { title: string; notes?: string }> =
          {};
        const criteria: Record<string, string | null> = {
          // Jev leans to the first option, so "none" first avoids false matches.
          [NONE_OPTION]:
            'The new task is not the same piece of work as any existing task',
        };

        existing.forEach((task, index) => {
          const id = `t${index}`;
          existingState[id] = {
            title: task.title.trim(),
            ...(task.notes?.trim()
              ? { notes: task.notes.trim().slice(0, MAX_NOTES_CHARS) }
              : {}),
          };
          criteria[id] = task.title.trim();
        });

        const newTasks: Record<string, { title: string; notes?: string }> = {};
        const questions: Record<string, TypeSafeChoiceQuestion> = {};

        group.forEach((candidate, index) => {
          const id = `c${index}`;
          newTasks[id] = {
            title: candidate.title.trim(),
            ...(candidate.notes?.trim()
              ? { notes: candidate.notes.trim().slice(0, MAX_NOTES_CHARS) }
              : {}),
          };
          questions[id] = {
            type: 'choice',
            instructions: `Does \`new_tasks.${id}\` ask for the same piece of work as one of the \`existing_tasks\`? Choose that existing task, or none. Similar topic alone is not enough; the same action on the same thing is.`,
            criteria,
          };
        });

        const { answers } = await askTypeSafe({
          state: { existing_tasks: existingState, new_tasks: newTasks },
          questions,
        });

        group.forEach((candidate, index) => {
          const answer = answers[`c${index}`];

          if (
            !answer ||
            answer.type !== 'choice' ||
            answer.choice === NONE_OPTION ||
            answer.confidence < DUPLICATE_MIN_CONFIDENCE ||
            (answer.probabilities[answer.choice] ?? 0) <
              DUPLICATE_MIN_PROBABILITY
          ) {
            return;
          }

          const match = existing[Number(answer.choice.slice(1))];

          if (match) {
            duplicates.set(candidate.key, {
              existingTaskId: match.id,
              existingTitle: match.title,
            });
          }
        });
      } catch (error) {
        console.error(
          '[find-duplicate-tasks] skipped',
          error instanceof Error ? error.message : String(error),
        );
      }
    }),
  );

  return duplicates;
}
