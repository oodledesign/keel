export const DISPOSALS_AI_FORMATS = ['answer', 'linkedin', 'blog'] as const;

export type DisposalsAiFormat = (typeof DISPOSALS_AI_FORMATS)[number];

export const DISPOSALS_AI_FORMAT_LABELS: Record<DisposalsAiFormat, string> = {
  answer: 'Answer',
  linkedin: 'LinkedIn post',
  blog: 'Blog post',
};

export const DISPOSALS_AI_PROMPT_MAX_LENGTH = 1000;

const DISPOSALS_AI_EXCLUDED_ROLES = new Set(['client', 'contractor']);

export function canRoleUseDisposalsAi(role: string | null | undefined) {
  return Boolean(role) && !DISPOSALS_AI_EXCLUDED_ROLES.has(role!);
}

export type DisposalsAiPreset = {
  id: string;
  label: string;
  prompt: string;
  format: DisposalsAiFormat;
};

export const DISPOSALS_AI_PRESETS: DisposalsAiPreset[] = [
  {
    id: 'linkedin-last-month',
    label: "LinkedIn post: last month's activity",
    prompt:
      "Write a LinkedIn post for last month's activity: new instructions, properties that went under offer and completions.",
    format: 'linkedin',
  },
  {
    id: 'blog-last-month',
    label: 'Blog post: last month round-up',
    prompt:
      "Write a blog post rounding up last month's disposals activity for our website.",
    format: 'blog',
  },
  {
    id: 'compare-month-last-year',
    label: 'This month vs same month last year',
    prompt: 'How did we do this month compared with the same month last year?',
    format: 'answer',
  },
  {
    id: 'under-offer-now',
    label: "What's under offer right now?",
    prompt:
      "What's under offer right now, and what went under offer last month?",
    format: 'answer',
  },
];
