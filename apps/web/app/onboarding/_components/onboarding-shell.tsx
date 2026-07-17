'use client';

import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { AppLogo } from '~/components/app-logo';

import {
  type CompanyRole,
  getStepIndex,
  getStepsForPersona,
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
    <div className="flex min-h-screen flex-col bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] md:flex-row">
      <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 md:absolute md:top-0 md:right-0 md:left-0 md:z-10">
        <AppLogo href={null} className="h-8 w-auto" />
        {helpHref && (
          <span className="text-sm text-[var(--workspace-shell-text-muted)]">
            Having trouble?{' '}
            <Link
              href={helpHref}
              target="_blank"
              rel="noopener"
              className="text-[var(--ozer-accent)] hover:text-[var(--ozer-accent-muted)]"
            >
              Get help
            </Link>
          </span>
        )}
      </header>

      <aside className="mt-14 w-full border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60 p-6 md:mt-14 md:w-64 md:border-r md:border-b-0">
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
                className="h-10 w-10 rounded-full bg-[var(--workspace-control-surface)] hover:bg-[var(--workspace-shell-panel-hover)]"
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
                className="rounded-full bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
                asChild
              >
                <a href={dashboardHref}>
                  Back to dashboard
                  {dashboardAccountName ? ` (${dashboardAccountName})` : ''}
                </a>
              </Button>
            )}
          </div>
          {isOwner && (
            <CancelTeamButton
              accountId={accountId}
              accountName={accountName ?? 'this team'}
            />
          )}
        </div>

        <div className="mx-auto w-full max-w-xl rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80 p-6 shadow-xl md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
