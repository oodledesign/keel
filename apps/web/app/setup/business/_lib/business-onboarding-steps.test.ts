import { describe, expect, it } from 'vitest';

import {
  BUSINESS_ONBOARDING_STEPS,
  BUSINESS_ONBOARDING_STEP_LABELS,
  isBusinessOnboardingStep,
  nextBusinessOnboardingStep,
} from './business-onboarding-steps';

describe('business onboarding steps', () => {
  it('walks company → client → workspace reveal → assistant → plan → done', () => {
    expect(BUSINESS_ONBOARDING_STEPS).toEqual([
      'company',
      'client',
      'task',
      'assistant',
      'plan',
    ]);
    expect(nextBusinessOnboardingStep('company')).toBe('client');
    expect(nextBusinessOnboardingStep('client')).toBe('task');
    expect(nextBusinessOnboardingStep('task')).toBe('assistant');
    expect(nextBusinessOnboardingStep('assistant')).toBe('plan');
    expect(nextBusinessOnboardingStep('plan')).toBe('done');
  });

  it('accepts only known steps', () => {
    expect(isBusinessOnboardingStep('company')).toBe(true);
    expect(isBusinessOnboardingStep('done')).toBe(false);
    expect(isBusinessOnboardingStep(null)).toBe(false);
  });

  it('labels the task step as the workspace reveal', () => {
    expect(BUSINESS_ONBOARDING_STEP_LABELS.task).toBe('Workspace');
  });
});
