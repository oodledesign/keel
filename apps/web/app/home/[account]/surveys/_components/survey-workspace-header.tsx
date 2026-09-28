'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { ArrowLeft, FileText, Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { SurveyStatusBadge } from '~/components/surveys/survey-status-badge';
import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { generateSurveyDraftAction } from '../_lib/server/survey-capture-actions';
import { surveyPath } from '../_lib/survey-display';

type SurveyTab = 'overview' | 'content' | 'builder';

function activeTabForPath(pathname: string): SurveyTab {
  if (/\/edit\/?$/.test(pathname)) return 'builder';
  if (/\/review(\/|$)/.test(pathname)) return 'content';
  return 'overview';
}

export function SurveyWorkspaceHeader({
  accountSlug,
  proposalId,
  title,
  clientName,
  status,
  actions,
}: {
  accountSlug: string;
  proposalId: string;
  title: string;
  clientName: string | null;
  status: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = activeTabForPath(pathname);
  const surveysHref = pathsConfig.app.accountSurveys.replace(
    '[account]',
    accountSlug,
  );
  const tabs: Array<{ key: SurveyTab; label: string; href: string }> = [
    {
      key: 'overview',
      label: 'Overview',
      href: surveyPath(
        pathsConfig.app.accountSurveyDetail,
        accountSlug,
        proposalId,
      ),
    },
    {
      key: 'content',
      label: 'Content review',
      href: surveyPath(
        pathsConfig.app.accountSurveyReview,
        accountSlug,
        proposalId,
      ),
    },
    {
      key: 'builder',
      label: 'Report builder',
      href: surveyPath(
        pathsConfig.app.accountSurveyEdit,
        accountSlug,
        proposalId,
      ),
    },
  ];

  return (
    <header
      className="flex flex-col gap-3 text-[var(--workspace-shell-text)]"
      data-test="survey-workspace-header"
    >
      <Link
        href={surveysHref}
        className={`inline-flex w-fit items-center gap-1.5 text-sm ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to surveys
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{title}</h1>
          <p className={`mt-0.5 text-sm ${workspaceTextMuted}`}>
            {clientName ?? 'No client linked'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SurveyStatusBadge status={status} />
          {actions}
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-[color:var(--workspace-shell-border)]"
        aria-label="Survey sections"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? 'page' : undefined}
            data-test={`survey-tab-${tab.key}`}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active === tab.key
                ? 'border-[var(--ozer-accent)] text-[var(--workspace-shell-text)]'
                : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SurveyGenerateDraftButton({
  accountSlug,
  accountId,
  proposalId,
  accountName,
  surveyorName,
  disabled,
}: {
  accountSlug: string;
  accountId: string;
  proposalId: string;
  accountName: string;
  surveyorName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const builderHref = surveyPath(
    pathsConfig.app.accountSurveyEdit,
    accountSlug,
    proposalId,
  );

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateSurveyDraftAction({
        accountId,
        accountSlug,
        proposalId,
        accountName,
        surveyorName,
      });
      router.refresh();
      toast.success(
        result.source === 'ai'
          ? 'Draft report updated from your notes.'
          : (result.fallbackReason ??
              'Drafted from keyword routing because the AI path was unavailable.'),
        {
          action: {
            label: 'Open builder',
            onClick: () => router.push(builderHref),
          },
        },
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      type="button"
      className={workspaceBtnPrimaryMd}
      disabled={disabled || generating}
      title={disabled ? 'Add notes or a site meeting first' : undefined}
      onClick={() => void handleGenerate()}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      Generate draft
    </button>
  );
}
