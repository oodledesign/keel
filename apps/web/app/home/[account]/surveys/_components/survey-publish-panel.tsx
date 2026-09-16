'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Download, Loader2, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { documentEditPath } from '~/lib/building-surveyor/document-kind';
import type { SurveyGapCheckResult } from '~/lib/building-surveyor/survey-report-gap-check';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { checkSurveyPublishGapsAction } from '../_lib/server/survey-capture-actions';

export function SurveyPublishPanel({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  hasDraft,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  hasDraft: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [useAi, setUseAi] = useState(false);
  const [result, setResult] = useState<
    (SurveyGapCheckResult & { source?: string }) | null
  >(null);
  const editHref = documentEditPath(accountSlug, proposalId, 'survey_report');
  const pdfHref = `/api/proposals/pdf?proposalId=${proposalId}`;

  return (
    <section className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}>
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Publish
      </h3>
      <p className={`text-xs ${workspaceTextMuted}`}>
        Download a firm-branded PDF or send it to the client. The optional gap
        check flags empty sections and photo/text mismatches — it does not
        rewrite your notes.
      </p>

      <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text)]">
        <input
          type="checkbox"
          checked={useAi}
          onChange={(event) => setUseAi(event.target.checked)}
          className="rounded border-[color:var(--workspace-control-border)]"
        />
        Include a light AI consistency check (Ozer credits)
      </label>

      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const next = await checkSurveyPublishGapsAction({
                    accountId,
                    accountSlug,
                    proposalId,
                    useAi,
                  });
                  setResult(next);
                  toast.success(
                    next.readyToPublish
                      ? 'No gaps found'
                      : `${next.flags.length} gap${next.flags.length === 1 ? '' : 's'} flagged`,
                  );
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              });
            }}
          >
            {pending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Run gap check
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={pdfHref}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download PDF
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          className={workspaceBtnPrimaryMd}
          asChild
        >
          <Link href={editHref}>
            <Send className="mr-2 h-3.5 w-3.5" />
            Send to client
          </Link>
        </Button>
      </div>

      {!hasDraft ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Generate or open the report editor first so the PDF has firm
          boilerplate (cover, about the inspection, terms).
        </p>
      ) : (
        <p className="text-xs">
          <Link href={editHref} className={workspaceLinkAccent}>
            Open report editor
          </Link>
        </p>
      )}

      {result ? (
        <ul className="space-y-1.5 text-xs">
          {result.readyToPublish ? (
            <li className="text-[var(--workspace-shell-text)]">
              Ready to publish. No empty sections or photo/text mismatches.
            </li>
          ) : (
            result.flags.map((flag) => (
              <li
                key={`${flag.kind}-${flag.sectionKey}`}
                className={workspaceTextMuted}
              >
                <span className="font-medium text-[var(--workspace-shell-text)]">
                  {flag.ricsCode || flag.label}
                </span>
                {' — '}
                {flag.detail}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
