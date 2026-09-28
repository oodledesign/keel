'use client';

import { useTransition } from 'react';

import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  HOME_SURVEY_LEVEL_OPTIONS,
  type SurveyLevel,
  surveyLevelLabel,
} from '~/lib/building-surveyor/survey-types';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { updateSurveyLevelAction } from '../_lib/server/survey-prep-actions';

export function SurveyLevelSetting({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  surveyLevel,
  onChange,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  surveyLevel: SurveyLevel;
  onChange: (level: SurveyLevel) => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleLevel = (next: SurveyLevel) => {
    const previous = surveyLevel;
    onChange(next);
    startTransition(async () => {
      try {
        const result = await updateSurveyLevelAction({
          accountId,
          accountSlug,
          proposalId,
          surveyLevel: next,
        });
        onChange(result.surveyLevel);
        toast.success(`${surveyLevelLabel(result.surveyLevel)} saved`);
      } catch (error) {
        onChange(previous);
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div className="space-y-2">
      <Label className={`text-xs ${workspaceTextMuted}`}>Survey level</Label>
      {canEdit ? (
        <div className="flex">
          <div className="inline-flex gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1 text-xs">
            {HOME_SURVEY_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.level}
                type="button"
                disabled={pending}
                data-test={`survey-level-${option.level}`}
                onClick={() => handleLevel(option.level)}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  surveyLevel === option.level
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm">{surveyLevelLabel(surveyLevel)}</p>
      )}
    </div>
  );
}
