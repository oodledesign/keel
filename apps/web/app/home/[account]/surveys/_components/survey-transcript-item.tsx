'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ListChecks, Loader2, Pencil } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import type {
  SurveyTranscriptNotesPreview,
  SurveyTranscriptSummary,
} from '../_lib/schema/survey-capture.schema';
import {
  previewSurveyTranscriptNotesAction,
  updateSurveyTranscriptAction,
} from '../_lib/server/survey-capture-actions';
import { SurveyTranscriptSortDialog } from './survey-transcript-sort-dialog';

export function SurveyTranscriptItem({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  transcript,
  noteCount,
  contentHref,
  onSaved,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  transcript: SurveyTranscriptSummary;
  noteCount: number;
  contentHref: string;
  onSaved: (next: SurveyTranscriptSummary) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(transcript.title);
  const [content, setContent] = useState(transcript.content);
  const [pending, startTransition] = useTransition();
  const [sorting, startSorting] = useTransition();
  const [preview, setPreview] = useState<SurveyTranscriptNotesPreview | null>(
    null,
  );
  const startSort = () => {
    startSorting(async () => {
      try {
        const next = await previewSurveyTranscriptNotesAction({
          accountId,
          accountSlug,
          proposalId,
          transcriptId: transcript.id,
        });
        setPreview(next);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const startEditing = () => {
    setTitle(transcript.title);
    setContent(transcript.content);
    setEditing(true);
  };

  const save = () => {
    const nextTitle = title.trim() || 'Site visit';
    const nextContent = content.trim();
    if (!nextContent) {
      toast.error('The site visit text cannot be empty.');
      return;
    }
    startTransition(async () => {
      try {
        const saved = await updateSurveyTranscriptAction({
          accountId,
          accountSlug,
          proposalId,
          transcriptId: transcript.id,
          title: nextTitle,
          content: nextContent,
        });
        onSaved(saved);
        setEditing(false);
        toast.success('Site visit saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  if (editing) {
    return (
      <li className="space-y-2 py-3 first:pt-0">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Visit title"
          disabled={pending}
          data-test="survey-transcript-title-input"
        />
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-56 text-sm"
          disabled={pending}
          maxLength={120_000}
          data-test="survey-transcript-content-input"
        />
        <p className={`text-xs ${workspaceTextMuted}`}>
          Saving doesn&apos;t change notes already in Content review. Use Sort
          into notes afterwards to update them.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={pending}
            data-test="survey-transcript-save"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {transcript.title}
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            {noteCount > 0
              ? `${noteCount} note${noteCount === 1 ? '' : 's'} in Content review`
              : 'Not sorted into notes yet'}
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={startSort}
              disabled={sorting}
              data-test="survey-transcript-sort"
            >
              {sorting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              )}
              {sorting ? 'Sorting…' : 'Sort into notes'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={startEditing}
              data-test="survey-transcript-edit"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        ) : null}
      </div>
      <p
        className={`mt-1 text-xs whitespace-pre-wrap ${workspaceTextMuted} ${
          expanded ? '' : 'line-clamp-3'
        }`}
      >
        {transcript.content}
      </p>
      {transcript.content.length > 240 ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-[var(--ozer-accent)] hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      ) : null}
      {preview ? (
        <SurveyTranscriptSortDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          accountId={accountId}
          accountSlug={accountSlug}
          proposalId={proposalId}
          transcriptId={transcript.id}
          transcriptTitle={transcript.title}
          preview={preview}
          onApplied={({ observations, removed }) => {
            setPreview(null);
            const added = observations.length;
            const message =
              added > 0
                ? `Added ${added} note${added === 1 ? '' : 's'}${
                    removed > 0 ? `, removed ${removed}` : ''
                  }.`
                : `Removed ${removed} note${removed === 1 ? '' : 's'}.`;
            toast.success(message, {
              action: {
                label: 'Review',
                onClick: () => router.push(contentHref),
              },
            });
            router.refresh();
          }}
        />
      ) : null}
    </li>
  );
}
