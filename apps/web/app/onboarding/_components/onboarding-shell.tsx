'use client';

import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { AppLogo } from '~/components/app-logo';

import {
  getStepsForPersona,
  getStepIndex,
  type CompanyRole,
} from '../_lib/onboarding-steps.config';
import { CancelTeamButton } from './cancel-team-button';
import { StepSidebar } from './step-sidebar';

interface OnboardingShellProps {
  children: React.ReactNode;
  companyRole: CompanyRole | null;
  currentStep: number;
  accountId: string;
  accountName?: string | null;
  /** Saved onboarding step from DB so step checkmarks persist when going back */
  savedOnboardingStep?: number | null;
  backHref?: string | null;
  /** When set, show "Back to dashboard" linking to this team (for users who already have a completed team) */
  dashboardHref?: string | null;
  dashboardAccountName?: string | null;
  /** When true, show "Cancel this team" (owner only) */
  isOwner?: boolean;
  helpHref?: string;
}

export function OnboardingShell({
  children,
  companyRole,
  currentStep,
  accountId,
  accountName,
  savedOnboardingStep,
  backHref,
  dashboardHref,
  dashboardAccountName,
  isOwner = false,
  helpHref = '/docs',
}: OnboardingShellProps) {
  const steps = getStepsForPersona(companyRole);
  const currentIndex = getStepIndex(companyRole, currentStep);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 md:absolute md:left-0 md:right-0 md:top-0 md:z-10">
        <AppLogo href={null} className="h-8 w-auto" />
        {helpHref && (
          <span className="text-sm text-zinc-400">
            Having trouble?{' '}
            <Link
              href={helpHref}
              target="_blank"
              rel="noopener"
              className="text-emerald-500 hover:text-emerald-400"
            >
              Get help
            </Link>
          </span>
        )}
      </header>

      <aside className="mt-14 w-full border-b border-zinc-800 bg-zinc-900/60 p-6 md:mt-14 md:w-64 md:border-b-0 md:border-r">
        <StepSidebar
          steps={steps}
          currentIndex={currentIndex}
          currentStep={currentStep}
          accountName={accountName}
          savedOnboardingStep={savedOnboardingStep}
        />
      </aside>

      <main className="mt-4 flex flex-1 flex-col p-4 md:mt-14 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {backHref != null && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-zinc-800 hover:bg-zinc-700"
                asChild
              >
                <a href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                </a>
              </Button>
            )}
            {dashboardHref != null && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                asChild
              >
                <a href={dashboardHref}>
                  Back to dashboard{dashboardAccountName ? ` (${dashboardAccountName})` : ''}
                </a>
              </Button>
            )}
          </div>
          {isOwner && (
            <CancelTeamButton accountId={accountId} accountName={accountName ?? 'this team'} />
          )}
        </div>

        <div className="mx-auto w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
