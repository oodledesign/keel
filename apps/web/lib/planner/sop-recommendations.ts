import type { PlannerTask, SopSuggestion } from './types';

type PlaybookLike = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'with',
  'from',
  'your',
  'my',
  'our',
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

export function recommendSopsForTasks(
  tasks: PlannerTask[],
  playbooks: PlaybookLike[],
  playbookHref: (playbookId: string) => string,
  limit = 2,
): SopSuggestion[] {
  if (tasks.length === 0 || playbooks.length === 0) return [];

  const taskTokens = tokens(
    tasks
      .map((task) => [task.title, task.project, task.notes ?? ''].join(' '))
      .join(' '),
  );

  const scored = playbooks
    .map((playbook) => {
      const playbookTokens = tokens(
        [playbook.title, playbook.description ?? '', playbook.category ?? ''].join(
          ' ',
        ),
      );
      const score = overlapScore(taskTokens, playbookTokens);
      return { playbook, score };
    })
    .filter((entry) => entry.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ playbook, score }) => ({
    id: playbook.id,
    title: playbook.title,
    href: playbookHref(playbook.id),
    reason:
      score >= 0.5
        ? 'Matches several items on your plan'
        : 'May help with something on your list',
  }));
}
