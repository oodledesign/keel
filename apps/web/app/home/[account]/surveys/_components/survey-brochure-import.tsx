'use client';

import { useRef, useState } from 'react';

import { FileUp, Loader2 } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type { BrochureMappedPassage } from '~/lib/building-surveyor/brochure-import';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  applySurveyBrochureAction,
  previewSurveyBrochureAction,
} from '../_lib/server/survey-brochure-actions';

type ChoiceMode = 'exact' | 'rewritten' | 'skip';

export function SurveyBrochureImport({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [passages, setPassages] = useState<BrochureMappedPassage[]>([]);
  const [modes, setModes] = useState<Record<string, ChoiceMode>>({});

  const onPick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !canEdit) return;
    if (
      !file.name.toLowerCase().endsWith('.pdf') &&
      file.type !== 'application/pdf'
    ) {
      toast.error('Upload a PDF brochure');
      return;
    }

    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${accountId}/${proposalId}/brochure_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(ACCOUNT_DOCS_BUCKET)
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const result = await previewSurveyBrochureAction({
        accountId,
        accountSlug,
        proposalId,
        filePath,
        originalFilename: file.name,
        mimeType: file.type || 'application/pdf',
      });

      setPassages(result.passages);
      setModes(
        Object.fromEntries(
          result.passages.map((item) => [
            item.sectionKey,
            'rewritten' as const,
          ]),
        ),
      );
      if (result.passages.length === 0) {
        toast.message('No location or grounds text found in that brochure');
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const apply = async () => {
    if (!canEdit || passages.length === 0) return;
    setBusy(true);
    try {
      const result = await applySurveyBrochureAction({
        accountId,
        accountSlug,
        proposalId,
        choices: passages.map((item) => ({
          sectionKey: item.sectionKey,
          mode: modes[item.sectionKey] ?? 'skip',
          exactText: item.exactText,
          rewrittenText: item.rewrittenText,
        })),
      });
      toast.success(
        result.createdCount === 1
          ? '1 note added from brochure'
          : `${result.createdCount} notes added from brochure`,
      );
      setPassages([]);
      setModes({});
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Agent brochure
          </h3>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Import location and grounds text from a PDF. Choose exact wording or
            an AI rewrite for each section before saving.
          </p>
        </div>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={!canEdit || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          Import agent brochure (PDF)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => void onPick(event.target.files)}
        />
      </div>

      {passages.length > 0 ? (
        <div className="space-y-3 border-t border-[var(--workspace-shell-border)] pt-3">
          {passages.map((passage) => (
            <div key={passage.sectionKey} className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)] uppercase">
                {passage.sectionKey.replaceAll('_', ' ')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['exact', 'Use exact'],
                    ['rewritten', 'Use AI rewrite'],
                    ['skip', 'Skip'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      (modes[passage.sectionKey] ?? 'skip') === value
                        ? 'bg-[var(--workspace-shell-accent)] text-white'
                        : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                    }`}
                    onClick={() =>
                      setModes((prev) => ({
                        ...prev,
                        [passage.sectionKey]: value,
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={`text-xs ${workspaceTextMuted}`}>Exact</p>
              <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                {passage.exactText || '—'}
              </p>
              <p className={`text-xs ${workspaceTextMuted}`}>AI rewrite</p>
              <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                {passage.rewrittenText || '—'}
              </p>
            </div>
          ))}
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={busy}
            onClick={() => void apply()}
          >
            Save selected notes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
