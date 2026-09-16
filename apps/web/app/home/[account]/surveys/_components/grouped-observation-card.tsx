'use client';

import { useState, useTransition } from 'react';

import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { CONDITION_RATINGS } from '~/lib/building-surveyor/condition-rating';
import { phraseInsertMode } from '~/lib/building-surveyor/phrase-insert-blocks';
import { ricsCodeForSectionKey } from '~/lib/building-surveyor/report-sections';
import {
  type HubSurveySection,
  hubSectionDisplayLabel,
} from '~/lib/building-surveyor/survey-section-catalogue';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

import type { SurveyObservation } from '../_lib/schema/survey-capture.schema';
import {
  deleteSurveyObservationAction,
  updateSurveyObservationAction,
} from '../_lib/server/survey-capture-actions';
import { SurveyPhraseInsert } from './survey-phrase-insert';

export function GroupedObservationCard({
  item,
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  sections,
  onChange,
  onDelete,
  onInsertAsBlock,
}: {
  item: SurveyObservation;
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  sections: readonly HubSurveySection[];
  onChange: (next: SurveyObservation) => void;
  onDelete: (id: string) => void;
  onInsertAsBlock?: (body: string, defaultRating?: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(item.body);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <li className="rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
        <p className={`text-sm whitespace-pre-wrap ${workspaceText}`}>
          {item.body}
        </p>
      </li>
    );
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
        <div className="space-y-2">
          <select
            value={item.sectionKey}
            onChange={(event) => {
              const sectionKey = event.target.value;
              onChange({ ...item, sectionKey });
              startTransition(async () => {
                try {
                  await updateSurveyObservationAction({
                    accountId,
                    accountSlug,
                    proposalId,
                    observationId: item.id,
                    sectionKey,
                  });
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              });
            }}
            className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1 text-xs"
          >
            {sections.map((option) => (
              <option key={option.key} value={option.key}>
                {hubSectionDisplayLabel(option)}
              </option>
            ))}
          </select>
          <select
            value={item.conditionRating ?? ''}
            onChange={(event) => {
              const conditionRating = (event.target.value ||
                null) as SurveyObservation['conditionRating'];
              onChange({ ...item, conditionRating });
              startTransition(async () => {
                try {
                  await updateSurveyObservationAction({
                    accountId,
                    accountSlug,
                    proposalId,
                    observationId: item.id,
                    conditionRating,
                  });
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              });
            }}
            className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1 text-xs"
          >
            <option value="">No rating</option>
            {CONDITION_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
          <SurveyPhraseInsert
            accountId={accountId}
            ricsCode={item.ricsCode ?? ricsCodeForSectionKey(item.sectionKey)}
            sectionKey={item.sectionKey}
            onInsert={(body, defaultRating) => {
              if (
                phraseInsertMode(draftBody) === 'new-block' &&
                onInsertAsBlock
              ) {
                onInsertAsBlock(body, defaultRating);
                return;
              }
              setDraftBody(body);
              if (defaultRating && !item.conditionRating) {
                onChange({
                  ...item,
                  conditionRating:
                    defaultRating as SurveyObservation['conditionRating'],
                });
              }
            }}
          />
          <Textarea
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            className="min-h-20 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDraftBody(item.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={pending || !draftBody.trim()}
              onClick={() => {
                const body = draftBody.trim();
                if (!body) return;
                onChange({ ...item, body });
                setEditing(false);
                startTransition(async () => {
                  try {
                    await updateSurveyObservationAction({
                      accountId,
                      accountSlug,
                      proposalId,
                      observationId: item.id,
                      body,
                    });
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="group relative rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
      {item.conditionRating ? (
        <p className={`mb-1 text-[11px] ${workspaceTextMuted}`}>
          Rating {item.conditionRating}
        </p>
      ) : null}
      <p className={`pr-16 text-sm whitespace-pre-wrap ${workspaceText}`}>
        {item.body}
      </p>
      <div className="absolute top-2 right-2 hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={`h-7 w-7 ${workspaceTextMuted}`}
          aria-label="Edit observation"
          onClick={() => {
            setDraftBody(item.body);
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-400 hover:text-red-300"
          aria-label="Delete observation"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                await deleteSurveyObservationAction({
                  accountId,
                  accountSlug,
                  proposalId,
                  observationId: item.id,
                });
                onDelete(item.id);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
