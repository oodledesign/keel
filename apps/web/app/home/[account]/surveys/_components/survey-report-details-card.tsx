'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { updateSurveyReportDetailsAction } from '../_lib/server/survey-report-details-actions';
import type { SurveyReportDetails } from '../_lib/server/survey-report-details.service';

type DetailKey = 'inspectionDate' | 'termsReceivedDate' | 'reportReference';

export function SurveyReportDetailsCard({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  details,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  details: Pick<SurveyReportDetails, DetailKey>;
}) {
  const [values, setValues] = useState(details);
  const [saved, setSaved] = useState(details);
  const [pending, startTransition] = useTransition();
  const profileHref = pathsConfig.app.accountSurveyorProfileSettings.replace(
    '[account]',
    accountSlug,
  );

  const save = (key: DetailKey) => {
    const next = values[key]?.trim() || null;
    if (next === (saved[key] ?? null)) return;
    startTransition(async () => {
      try {
        const result = await updateSurveyReportDetailsAction({
          accountId,
          accountSlug,
          proposalId,
          [key]: next,
        });
        setSaved(result);
        setValues(result);
        toast.success('Report details saved');
      } catch (error) {
        setValues(saved);
        toast.error(getErrorMessage(error));
      }
    });
  };

  const field = (key: DetailKey, label: string, type: 'date' | 'text') => (
    <div className="space-y-1.5">
      <Label
        htmlFor={`survey-${key}`}
        className={`text-xs ${workspaceTextMuted}`}
      >
        {label}
      </Label>
      <Input
        id={`survey-${key}`}
        type={type}
        value={values[key] ?? ''}
        disabled={!canEdit || pending}
        data-test={`survey-detail-${key}`}
        onChange={(event) =>
          setValues((prev) => ({ ...prev, [key]: event.target.value }))
        }
        onBlur={() => save(key)}
      />
    </div>
  );

  return (
    <div className={`${workspacePanelCard} space-y-4 p-4 sm:p-5`}>
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Report details
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Shown on the cover, in section A and in the Reminder note. Your RICS
          number and qualifications come from your{' '}
          <Link href={profileHref} className={workspaceLinkAccent}>
            surveyor profile
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('inspectionDate', 'Inspection date', 'date')}
        {field('termsReceivedDate', 'Terms and conditions received', 'date')}
        {field('reportReference', 'Report reference', 'text')}
      </div>
    </div>
  );
}
