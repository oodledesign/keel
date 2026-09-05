export const BUSINESS_ONBOARDING_STEPS = [
  'company',
  'client',
  'task',
  'assistant',
  'plan',
] as const;

export type BusinessOnboardingStep =
  (typeof BUSINESS_ONBOARDING_STEPS)[number];

export const BUSINESS_ONBOARDING_STEP_LABELS: Record<
  BusinessOnboardingStep,
  string
> = {
  company: 'Company',
  client: 'Client',
  task: 'Task',
  assistant: 'Assistant',
  plan: 'Plan',
};

export function isBusinessOnboardingStep(
  value: string | null | undefined,
): value is BusinessOnboardingStep {
  return (
    value === 'company' ||
    value === 'client' ||
    value === 'task' ||
    value === 'assistant' ||
    value === 'plan'
  );
}

export function nextBusinessOnboardingStep(
  step: BusinessOnboardingStep,
): BusinessOnboardingStep | 'done' {
  const index = BUSINESS_ONBOARDING_STEPS.indexOf(step);
  return BUSINESS_ONBOARDING_STEPS[index + 1] ?? 'done';
}
