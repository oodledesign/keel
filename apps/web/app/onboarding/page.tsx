import { unstable_noStore } from 'next/cache';
import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

function getPersonalDetailsInitial(
  userSettings: OnboardingContext['userSettings'],
  prefillName: string | null,
): { first_name: string | null; last_name: string | null; mobile: string | null } | undefined {
  if (userSettings)
    return {
      first_name: userSettings.first_name,
      last_name: userSettings.last_name,
      mobile: userSettings.mobile,
    };
  if (!prefillName?.trim()) return undefined;
  const parts = prefillName.trim().split(/\s+/);
  const first_name = parts[0] ?? null;
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;
  return { first_name, last_name, mobile: null };
}

// Always fetch fresh onboarding context when navigating (back/forward) so green ticks and trade role are correct
export const dynamic = 'force-dynamic';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  getFirstCompletedOnboardingAccount,
  getFirstIncompleteOnboarding,
  isCurrentUserAccountOwner,
  requireOnboardingContext,
  type OnboardingContext,
} from './_lib/server/onboarding.loader';
import {
  getStepByIndex,
  getStepIndex,
  getStepsForPersona,
} from './_lib/onboarding-steps.config';
import { OnboardingShell } from './_components/onboarding-shell';
import { BusinessSummaryStep } from './_components/steps/business-summary-step';
import { CreateBusinessStep } from './_components/steps/create-business-step';
import { TradeStep } from './_components/steps/trade-step';
import { PersonalDetailsStep } from './_components/steps/personal-details-step';
import { AccessibilityStep } from './_components/steps/accessibility-step';
import { SubscriptionStep } from './_components/steps/subscription-step';
import { InviteStep } from './_components/steps/invite-step';

interface OnboardingPageProps {
  searchParams: Promise<{ account_id?: string; step?: string }>;
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  await requireUserInServerComponent();

  unstable_noStore(); // Ensure fresh ctx every time (green ticks + trade role when going back)
  const { account_id: accountIdParam, step: stepParam } =
    await searchParams;
  const stepNum = stepParam ? Math.max(1, parseInt(stepParam, 10)) : 1;

  // No account_id: if user already has a business with incomplete onboarding, send them there
  if (!accountIdParam) {
    const existing = await getFirstIncompleteOnboarding();
    if (existing) {
      redirect(
        `${pathsConfig.app.onboarding}?account_id=${existing.accountId}&step=${existing.step}`,
      );
    }
    const completedAccount = await getFirstCompletedOnboardingAccount();
    const dashboardHref = completedAccount
      ? `/home/${completedAccount.accountSlug}`
      : null;
    return (
      <OnboardingShell
        companyRole="admin"
        currentStep={1}
        accountId=""
        backHref={pathsConfig.app.home}
        dashboardHref={dashboardHref}
        dashboardAccountName={completedAccount?.accountName ?? null}
        isOwner={false}
      >
        <CreateBusinessStep />
      </OnboardingShell>
    );
  }

  const ctx = await requireOnboardingContext(accountIdParam);
  const steps = getStepsForPersona(ctx.companyRole);
  const maxStep = steps.length;
  const currentStep = Math.min(Math.max(stepNum, 1), maxStep);

  const stepDef =
    steps.find((s) => s.step === currentStep) ?? steps[0];
  const currentIndex = getStepIndex(ctx.companyRole, currentStep);
  const nextStepDef = getStepByIndex(ctx.companyRole, currentIndex + 1);
  const nextStep = nextStepDef?.step ?? currentStep;
  const backStepDef = getStepByIndex(ctx.companyRole, currentIndex - 1);
  const backHref =
    backStepDef != null
      ? `/onboarding?account_id=${ctx.accountId}&step=${backStepDef.step}`
      : null;

  // If already completed, redirect to account home
  if (ctx.onboardingCompleted) {
    redirect(`/home/${ctx.accountSlug}`);
  }

  const [completedAccount, isOwner] = await Promise.all([
    getFirstCompletedOnboardingAccount(ctx.accountId),
    isCurrentUserAccountOwner(ctx.accountId),
  ]);
  const dashboardHref = completedAccount
    ? `/home/${completedAccount.accountSlug}`
    : null;

  return (
    <OnboardingShell
      companyRole={ctx.companyRole}
      currentStep={currentStep}
      accountId={ctx.accountId}
      accountName={ctx.accountName}
      savedOnboardingStep={ctx.onboardingStep}
      backHref={backHref}
      dashboardHref={dashboardHref}
      dashboardAccountName={completedAccount?.accountName ?? null}
      isOwner={isOwner}
    >
      {stepDef?.key === 'create_business' && (
        <BusinessSummaryStep
          accountName={ctx.accountName}
          accountSlug={ctx.accountSlug}
          nextStepHref={`/onboarding?account_id=${ctx.accountId}&step=2`}
        />
      )}
      {stepDef?.key === 'trade' && (
        <TradeStep
          key={`trade-${ctx.accountId}-${ctx.tradeRole ?? 'none'}`}
          accountId={ctx.accountId}
          currentStep={currentStep}
          stepDef={stepDef}
          nextStep={nextStep}
          canSkip={stepDef.canSkip ?? true}
          initialTradeRole={ctx.tradeRole}
        />
      )}
      {stepDef?.key === 'personal' && (
        <PersonalDetailsStep
          accountId={ctx.accountId}
          nextStep={nextStep}
          initial={getPersonalDetailsInitial(ctx.userSettings, ctx.prefillName)}
        />
      )}
      {stepDef?.key === 'accessibility' && (
        <AccessibilityStep
          accountId={ctx.accountId}
          accountSlug={ctx.accountSlug}
          nextStep={nextStep}
          isLastStep={currentIndex === maxStep - 1}
          initial={ctx.userSettings ?? undefined}
        />
      )}
      {stepDef?.key === 'subscription' && (
        <SubscriptionStep
          accountId={ctx.accountId}
          accountSlug={ctx.accountSlug}
          hasActiveSubscription={ctx.hasActiveSubscription}
        />
      )}
      {stepDef?.key === 'invite' && (
        <InviteStep
          accountId={ctx.accountId}
          accountSlug={ctx.accountSlug}
        />
      )}
    </OnboardingShell>
  );
}
