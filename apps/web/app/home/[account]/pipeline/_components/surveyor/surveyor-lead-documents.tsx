'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertTriangle, FileText, Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type DroneFormValue,
  DroneOptionFields,
  EMPTY_DRONE_FORM,
} from '~/home/[account]/surveys/_components/drone-option-fields';
import { documentDetailPath } from '~/lib/building-surveyor/document-kind';
import { penceFromInput } from '~/lib/building-surveyor/survey-drone';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  type SurveyorLeadDocument,
  listSurveyorLeadDocumentsAction,
} from '../../_lib/server/surveyor-lead-actions';
import {
  createSurveyorQuoteAction,
  resolveSurveyorQuoteLeadChangeAction,
} from '../../_lib/server/surveyor-quote-actions';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  read: 'Read',
  approved: 'Accepted',
  declined: 'Declined',
};

/** Linked quote and survey, the lead-changed banner, and "Create quote". */
export function SurveyorLeadDocuments({
  accountId,
  accountSlug,
  dealId,
  hasAddress,
  refreshKey = 0,
}: {
  accountId: string;
  accountSlug: string;
  dealId: string;
  hasAddress: boolean;
  refreshKey?: number;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<SurveyorLeadDocument[] | null>(null);
  const [drone, setDrone] = useState<DroneFormValue>(EMPTY_DRONE_FORM);
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await listSurveyorLeadDocumentsAction({ accountId, dealId }));
    } catch (error) {
      console.error('[lead-documents] load failed', error);
      setDocs([]);
    }
  }, [accountId, dealId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const createQuote = async () => {
    const droneFee = drone.fee.trim() ? penceFromInput(drone.fee) : null;
    if (
      drone.used &&
      drone.billing === 'separate' &&
      drone.fee.trim() &&
      droneFee === null
    ) {
      toast.error('Enter the drone fee as an amount, for example 150');
      return;
    }
    setCreating(true);
    try {
      const result = await createSurveyorQuoteAction({
        accountId,
        accountSlug,
        dealId,
        droneUsed: drone.used,
        droneBilling: drone.billing,
        droneFeePence: droneFee ?? undefined,
      });
      router.push(
        pathsConfig.app.accountProposalEdit
          .replace('[account]', accountSlug)
          .replace('[id]', result.proposalId),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const resolve = async (
    proposalId: string,
    resolution: 'regenerate' | 'keep',
  ) => {
    setResolving(proposalId);
    try {
      await resolveSurveyorQuoteLeadChangeAction({
        accountId,
        accountSlug,
        proposalId,
        resolution,
      });
      toast.success(
        resolution === 'regenerate' ? 'Quote regenerated' : 'Edits kept',
      );
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResolving(null);
    }
  };

  const hasQuote = (docs ?? []).some((doc) => doc.kind === 'proposal');

  return (
    <div className="space-y-3">
      {docs === null ? (
        <p className={`text-xs ${workspaceTextMuted}`}>Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          No quote or survey linked yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                <Link
                  href={
                    doc.kind === 'survey_report'
                      ? documentDetailPath(accountSlug, doc.id, 'survey_report')
                      : doc.kind === 'terms_of_business'
                        ? pathsConfig.app.accountContractEdit
                            .replace('[account]', accountSlug)
                            .replace('[id]', doc.id)
                        : pathsConfig.app.accountProposalEdit
                            .replace('[account]', accountSlug)
                            .replace('[id]', doc.id)
                  }
                  className={`min-w-0 flex-1 truncate ${workspaceLinkAccent}`}
                >
                  {doc.kind === 'survey_report'
                    ? 'Survey'
                    : doc.kind === 'terms_of_business'
                      ? 'Terms'
                      : 'Quote'}{' '}
                  · {doc.title}
                </Link>
                <span className={`shrink-0 text-xs ${workspaceTextMuted}`}>
                  {STATUS_LABELS[doc.status] ?? doc.status}
                  {doc.kind === 'terms_of_business' && doc.signedPdfPath
                    ? ' · PDF'
                    : ''}
                </span>
              </div>
              {doc.leadChangedAt &&
              doc.status === 'draft' &&
              doc.kind === 'proposal' ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-[var(--workspace-shell-text)]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1">
                    Lead details changed since this quote was drafted.
                    Regenerate?
                  </span>
                  <button
                    type="button"
                    className={`font-medium ${workspaceLinkAccent}`}
                    disabled={resolving === doc.id}
                    onClick={() => void resolve(doc.id, 'regenerate')}
                  >
                    {resolving === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                  <button
                    type="button"
                    className={workspaceTextMuted}
                    disabled={resolving === doc.id}
                    onClick={() => void resolve(doc.id, 'keep')}
                  >
                    Keep my edits
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {docs !== null && !hasQuote ? (
        <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Standardised quote
          </p>
          <p className={`text-[11px] ${workspaceTextMuted}`}>
            Built from this lead: address, client, fee, Level 2 and Level 3,
            form of appointment and Terms of business. Draft quotes update when
            the lead changes.
          </p>
          <DroneOptionFields
            accountId={accountId}
            idPrefix={`lead-quote-drone-${dealId}`}
            value={drone}
            onChange={setDrone}
            disabled={creating}
          />
          <button
            type="button"
            className={`${workspaceBtnPrimaryMd} h-8 px-3 text-xs`}
            disabled={creating || !hasAddress}
            onClick={() => void createQuote()}
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {creating ? 'Creating quote…' : 'Create quote'}
          </button>
          {!hasAddress ? (
            <p className={`text-[11px] ${workspaceTextMuted}`}>
              Add the property address to create a quote.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
