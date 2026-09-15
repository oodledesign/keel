'use client';

import { useRef, useState } from 'react';

import { Loader2, Trash2, Upload } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { SURVEY_STYLE_ACCEPT } from '~/lib/building-surveyor/style-extract';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyStyleExample } from '../../../surveys/_lib/schema/survey-capture.schema';
import {
  addSurveyStyleExampleAction,
  deleteSurveyStyleExampleAction,
  updateSurveyStyleExampleAction,
} from '../../../surveys/_lib/server/survey-capture-actions';

export function SurveyStyleSettingsClient({
  accountId,
  accountSlug,
  canEdit,
  initialExamples,
}: {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  initialExamples: SurveyStyleExample[];
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [examples, setExamples] = useState(initialExamples);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${accountId}/survey-style/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(ACCOUNT_DOCS_BUCKET)
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const result = await addSurveyStyleExampleAction({
        accountId,
        accountSlug,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
        filePath,
        mimeType: file.type || null,
        originalFilename: file.name,
      });
      setExamples((prev) => [result.example, ...prev]);
      setTitle('');
      toast.success(
        result.source === 'ai'
          ? 'Style notes extracted from the report.'
          : (result.fallbackReason ??
              'Saved the report. Style notes were drafted from the extract.'),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${workspacePanelCard} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Survey style
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Upload a handful of past reports (PDF, Word, or HTML). We extract
          style notes for the firm and use them when drafting new surveys. Facts
          from those reports are not copied into new jobs.
        </p>

        {canEdit ? (
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="style-title">Title</Label>
              <Input
                id="style-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Level 2 terrace — house style"
                className="mt-1"
              />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={SURVEY_STYLE_ACCEPT}
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={uploading || examples.length >= 8}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload past report
            </Button>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Up to eight files, 15 MB each.
            </p>
          </div>
        ) : (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            You can view style notes but cannot change them.
          </p>
        )}
      </section>

      {examples.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No past reports yet. Drafts will use a standard RICS Home Survey voice
          until you add one.
        </p>
      ) : (
        <ul className="space-y-4">
          {examples.map((example) => (
            <li key={example.id} className={`${workspacePanelCard} p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {example.title}
                  </p>
                  <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                    {example.originalFilename ?? 'Uploaded report'}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                    onClick={() => {
                      void (async () => {
                        try {
                          await deleteSurveyStyleExampleAction({
                            accountId,
                            accountSlug,
                            exampleId: example.id,
                          });
                          setExamples((prev) =>
                            prev.filter((row) => row.id !== example.id),
                          );
                          toast.success('Style example removed');
                        } catch (error) {
                          toast.error(getErrorMessage(error));
                        }
                      })();
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
              {example.extractedPreview ? (
                <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
                  Extract: {example.extractedPreview}
                </p>
              ) : null}
              <Label className="mt-3 block text-xs">Style notes</Label>
              <Textarea
                defaultValue={example.styleNotes ?? ''}
                readOnly={!canEdit}
                className="mt-1 min-h-32 text-sm"
                onBlur={(event) => {
                  if (!canEdit) return;
                  const styleNotes = event.target.value.trim();
                  if (styleNotes === (example.styleNotes ?? '').trim()) return;
                  void (async () => {
                    try {
                      await updateSurveyStyleExampleAction({
                        accountId,
                        accountSlug,
                        exampleId: example.id,
                        styleNotes,
                      });
                      setExamples((prev) =>
                        prev.map((row) =>
                          row.id === example.id ? { ...row, styleNotes } : row,
                        ),
                      );
                      toast.success('Style notes saved');
                    } catch (error) {
                      toast.error(getErrorMessage(error));
                    }
                  })();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
