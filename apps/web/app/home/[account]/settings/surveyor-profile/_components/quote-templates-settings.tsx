'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  SURVEYOR_QUOTE_SURVEY_TYPES,
  type SurveyorQuoteSurveyType,
  defaultSurveyorQuoteLetterHtml,
  surveyorQuoteLetterName,
} from '~/lib/building-surveyor/surveyor-quote-letters';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { saveSurveyorQuoteTemplatesAction } from '../../../surveys/_lib/server/survey-report-details-actions';

export function QuoteTemplatesSettings({
  accountId,
  accountSlug,
  initialTemplates,
}: {
  accountId: string;
  accountSlug: string;
  initialTemplates: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<SurveyorQuoteSurveyType, string>>(
    () => {
      const next = {} as Record<SurveyorQuoteSurveyType, string>;
      for (const key of SURVEYOR_QUOTE_SURVEY_TYPES) {
        next[key] =
          initialTemplates[key]?.trim() || defaultSurveyorQuoteLetterHtml(key);
      }
      return next;
    },
  );

  const save = (reset = false) => {
    startTransition(async () => {
      try {
        if (reset) {
          await saveSurveyorQuoteTemplatesAction({
            accountId,
            accountSlug,
            reset: true,
          });
          const restored = {} as Record<SurveyorQuoteSurveyType, string>;
          for (const key of SURVEYOR_QUOTE_SURVEY_TYPES) {
            restored[key] = defaultSurveyorQuoteLetterHtml(key);
          }
          setDrafts(restored);
          toast.success('Quote templates reset to defaults');
        } else {
          await saveSurveyorQuoteTemplatesAction({
            accountId,
            accountSlug,
            quoteTemplates: drafts,
          });
          toast.success('Quote templates saved');
        }
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div className={`${workspacePanelCard} space-y-4 p-5`}>
      <div>
        <h2 className={`text-base font-semibold ${workspaceText}`}>
          Quote templates
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Override the letter used when creating a quote for each survey type.
          Use merge fields such as {'{{lead.clientName}}'} and{' '}
          {'{{lead.feeIncVat}}'}.
        </p>
      </div>

      {SURVEYOR_QUOTE_SURVEY_TYPES.map((key) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`quote-template-${key}`}>
            {surveyorQuoteLetterName(key)}
          </Label>
          <Textarea
            id={`quote-template-${key}`}
            className="min-h-40 font-mono text-xs"
            value={drafts[key]}
            onChange={(event) =>
              setDrafts((prev) => ({ ...prev, [key]: event.target.value }))
            }
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={pending}
          onClick={() => save(false)}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save quote templates
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => save(true)}
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}
