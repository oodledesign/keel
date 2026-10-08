export const BUSINESS_ONBOARDING_STEPS = [
  'company',
  'client',
  'task',
  'navigation',
  'assistant',
  'plan',
] as const;

export type BusinessOnboardingStep = (typeof BUSINESS_ONBOARDING_STEPS)[number];

/**
 * Steps `accounts.business_onboarding_step` can hold (CHECK constraint).
 * Navigation isn't stored, so a reload there resumes at Assistant.
 */
export type StoredBusinessOnboardingStep = Exclude<
  BusinessOnboardingStep,
  'navigation'
>;

export const BUSINESS_ONBOARDING_STEP_LABELS: Record<
  BusinessOnboardingStep,
  string
> = {
  company: 'Company',
  client: 'Client',
  task: 'Workspace',
  navigation: 'Navigation',
  assistant: 'Assistant',
  plan: 'Plan',
};

export function isBusinessOnboardingStep(
  value: string | null | undefined,
): value is StoredBusinessOnboardingStep {
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
