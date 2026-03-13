export type CompanyRole =
  | 'admin'
  | 'staff_member'
  | 'contractor'
  | 'client';

export interface StepDef {
  step: number;
  title: string;
  key: string;
  canSkip?: boolean;
}

const ADMIN_STEPS: StepDef[] = [
  { step: 1, title: 'Company Role', key: 'create_business' },
  { step: 2, title: 'Trade Role', key: 'trade' },
  { step: 3, title: 'Personal Details', key: 'personal' },
  { step: 4, title: 'Accessibility', key: 'accessibility' },
  { step: 5, title: 'Subscription', key: 'subscription', canSkip: false },
  { step: 6, title: 'Invite team', key: 'invite', canSkip: true },
];

const STAFF_STEPS: StepDef[] = [
  { step: 1, title: 'Trade Role', key: 'trade' },
  { step: 2, title: 'Personal Details', key: 'personal' },
  { step: 3, title: 'Accessibility', key: 'accessibility' },
];

const CLIENT_STEPS: StepDef[] = [
  { step: 1, title: 'Personal Details', key: 'personal' },
  { step: 2, title: 'Accessibility', key: 'accessibility' },
];

export function getStepsForPersona(
  companyRole: CompanyRole | null,
): StepDef[] {
  if (companyRole === 'admin') return ADMIN_STEPS;
  if (
    companyRole === 'staff_member' ||
    companyRole === 'contractor'
  )
    return STAFF_STEPS;
  if (companyRole === 'client') return CLIENT_STEPS;
  return STAFF_STEPS;
}

export function getMaxStepForPersona(
  companyRole: CompanyRole | null,
): number {
  const steps = getStepsForPersona(companyRole);
  return steps.length;
}

export function getStepIndex(
  companyRole: CompanyRole | null,
  onboardingStep: number,
): number {
  const steps = getStepsForPersona(companyRole);
  const idx = steps.findIndex((s) => s.step === onboardingStep);
  return idx >= 0 ? idx : 0;
}

export function getStepByIndex(
  companyRole: CompanyRole | null,
  index: number,
): StepDef | undefined {
  const steps = getStepsForPersona(companyRole);
  return steps[index];
}
