'use client';

import { useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { SopPlaybookRow, SopPlaybookStepRow } from '~/lib/sops/shared';
import { resolveSopTargetRoute } from '~/lib/sops/shared';

import { startSopRunAction } from '../_lib/server/sops-actions';
import { setSopTrackerVisible } from '../_lib/sop-tracker-session';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]';

type SopPlaybookGuideProps = {
  accountId: string;
  accountSlug: string;
  playbook: SopPlaybookRow;
  steps: SopPlaybookStepRow[];
};

export function SopPlaybookGuide({
  accountId,
  accountSlug,
  playbook,
  steps,
}: SopPlaybookGuideProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const libraryPath = pathsConfig.app.accountSops.replace(
    '[account]',
    accountSlug,
  );
  const playbookPath = pathsConfig.app.accountSopsPlaybook
    .replace('[account]', accountSlug)
    .replace('[playbookId]', playbook.id);

  function startAssist() {
    startTransition(async () => {
      try {
        const result = await startSopRunAction({
          accountId,
          accountSlug,
          playbookId: playbook.id,
          assistMode: true,
          resumeIfActive: true,
        });
        if (!result?.runId) return;

        setSopTrackerVisible(accountId, result.runId, true);

        const firstStep = steps.find((s) => s.target_route) ?? steps[0];
        const target =
          resolveSopTargetRoute(firstStep?.target_route, accountSlug) ??
          pathsConfig.app.accountListings.replace('[account]', accountSlug);

        const url = new URL(target, window.location.origin);
        url.searchParams.set('sopAssist', result.runId);
        router.push(`${url.pathname}${url.search}`);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not start Assist mode',
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-0">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={libraryPath}
          className="text-[var(--ozer-accent)] hover:underline"
        >
          ← All SOPs
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          href={playbookPath}
          className="text-[var(--ozer-accent)] hover:underline"
        >
          Playbook
        </Link>
      </div>

      <div className={`${panelClass} p-6`}>
        <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Read-only guide
        </p>
        <h1 className="mt-2 text-xl font-bold text-[var(--workspace-shell-text)]">
          {playbook.title}
        </h1>
        {playbook.description ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {playbook.description}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-sm">
          Read the full process end-to-end before you start. This view does not
          track progress. When you are ready, use Assist me for a guided
          walkthrough with a live checklist.
        </p>

        <div className="mt-6">
          <Button
            type="button"
            disabled={pending || steps.length === 0}
            onClick={startAssist}
            className="ozer-gradient-btn rounded-xl"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Assist me
          </Button>
        </div>
      </div>

      <ol className={`${panelClass} divide-y divide-white/6`}>
        {steps.map((step, index) => (
          <li key={step.id} className="px-5 py-5">
            <p className="text-xs font-semibold text-[var(--workspace-shell-text-muted)]">
              Step {index + 1}
            </p>
            <h2 className="mt-1 font-semibold text-[var(--workspace-shell-text)]">
              {step.title}
            </h2>
            {step.body_md ? (
              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                {step.body_md}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
