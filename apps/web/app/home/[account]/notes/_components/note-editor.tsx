'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Pin } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { AskBrainLink } from '../../brain/_components/ask-brain-link';
import { saveWorkspaceNoteAction as saveWorkNoteAction } from '../../_lib/workspace-content/notes-actions';

type NoteEditorProps = {
  accountId: string;
  accountSlug: string;
  note: {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    jobId?: string | null;
    clientId?: string | null;
    propertyId?: string | null;
    projectName: string | null;
    clientName: string | null;
  };
};

export function NoteEditor({ accountId, accountSlug, note }: NoteEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isPinned, setIsPinned] = useState(note.isPinned);

  const onSave = () => {
    startTransition(async () => {
      try {
        const link = note.jobId
          ? { type: 'job' as const, id: note.jobId }
          : note.clientId
            ? { type: 'client' as const, id: note.clientId }
            : note.propertyId
              ? { type: 'property' as const, id: note.propertyId }
              : null;

        await saveWorkNoteAction({
          accountId,
          accountSlug,
          noteId: note.id,
          title,
          content,
          isPinned,
          link,
        });
        toast.success('Note saved');
        router.refresh();
      } catch {
        toast.error('Could not save note');
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {(note.projectName || note.clientName) && (
        <p className="text-sm text-zinc-400">
          {note.projectName ? (
            <span>Project: {note.projectName}</span>
          ) : null}
          {note.projectName && note.clientName ? ' · ' : null}
          {note.clientName ? <span>Client: {note.clientName}</span> : null}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="note-title" className="text-zinc-300">
          Title
        </Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-content" className="text-zinc-300">
          Content
        </Label>
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="Write in Markdown — **bold**, headings, lists…"
          className="min-h-[320px] border-white/10 bg-[var(--workspace-shell-panel)] text-white"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsPinned((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
            isPinned
              ? 'bg-amber-500/15 text-amber-300'
              : 'text-zinc-400 hover:bg-white/5',
          )}
        >
          <Pin className="h-4 w-4" />
          {isPinned ? 'Pinned' : 'Pin note'}
        </button>

        <div className="flex gap-2">
          <AskBrainLink
            accountSlug={accountSlug}
            label="Ask about this note"
            className="border-white/10 text-zinc-300"
            params={{
              jobId: note.jobId ?? undefined,
              clientId: note.clientId ?? undefined,
              q: `Summarise this note: "${title || 'Untitled note'}"`,
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            onClick={() =>
              router.push(
                pathsConfig.app.accountNotes.replace('[account]', accountSlug),
              )
            }
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={onSave}
            className="keel-gradient-btn"
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
