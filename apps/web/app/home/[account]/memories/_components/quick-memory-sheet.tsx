'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  workspaceBtnPrimaryMd,
  workspaceFilterActive,
} from '~/lib/workspace-ui';

import {
  MEMORY_KINDS,
  MEMORY_KIND_LABELS,
  type MemoryKind,
  todayIsoDate,
} from '../_lib/memory-constants';
import {
  MEMORY_MEDIA_MAX_LABEL,
  assertMemoryMedia,
  classifyMemoryMedia,
  getUnknownErrorMessage,
  normalizeMemoryMimeType,
} from '../_lib/memory-media';
import {
  completeFamilyMemoryMediaAction,
  prepareFamilyMemoryMediaAction,
  saveFamilyMemoryAction,
} from '../_lib/server/family-memories-actions';
import type { FamilyMemoryChild } from '../_lib/server/family-memories.loader';
import { ChildAvatar } from './child-avatar';
import { MemoryVoiceRecorder } from './memory-voice-recorder';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  people: FamilyMemoryChild[];
  defaultChildIds?: string[];
};

export function QuickMemorySheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  people,
  defaultChildIds = [],
}: Props) {
  const router = useRouter();
  const supabase = useSupabase();
  const visualInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIsoDate());
  const [kind, setKind] = useState<MemoryKind | null>(null);
  const [childIds, setChildIds] = useState<string[]>(defaultChildIds);
  const [files, setFiles] = useState<File[]>([]);
  const [keepRecording, setKeepRecording] = useState(true);

  const children = people.filter((person) => person.is_child);

  useEffect(() => {
    if (!open) return;
    setContent('');
    setTitle('');
    setOccurredAt(todayIsoDate());
    setKind(null);
    setChildIds(defaultChildIds);
    setFiles([]);
    setKeepRecording(true);
    if (visualInputRef.current) visualInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
  }, [open, defaultChildIds]);

  function toggleChild(id: string) {
    setChildIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function addFiles(list: FileList | null) {
    if (!list) return;

    const next: File[] = [];
    for (const file of Array.from(list)) {
      try {
        assertMemoryMedia({
          mimeType: normalizeMemoryMimeType(file.type, file.name),
          filename: file.name,
          size: file.size,
        });
        next.push(file);
      } catch (error) {
        toast.error(getUnknownErrorMessage(error, 'Could not attach that file'));
      }
    }

    if (next.length === 0) return;
    setFiles((current) => [...current, ...next].slice(0, 8));
  }

  function fileLabel(file: File) {
    const kind = classifyMemoryMedia(file.type, file.name);
    if (kind === 'audio') return `Voice note · ${file.name}`;
    if (kind === 'video') return `Video · ${file.name}`;
    return file.name;
  }

  async function attachFiles(noteId: string, attachments: File[]) {
    for (const file of attachments) {
      const mime = normalizeMemoryMimeType(file.type, file.name);
      const prepared = await prepareFamilyMemoryMediaAction({
        accountId,
        accountSlug,
        noteId,
        filename: file.name,
        mimeType: mime,
        fileSizeBytes: file.size,
      });

      const { error: uploadError } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.filePath, prepared.token, file, {
          contentType: prepared.mimeType || mime || file.type || undefined,
        });
      if (uploadError) {
        throw uploadError;
      }

      await completeFamilyMemoryMediaAction({
        accountId,
        accountSlug,
        noteId,
        filePath: prepared.filePath,
        filename: file.name,
        mimeType: prepared.mimeType || mime,
        title: file.name,
        fileSizeBytes: file.size,
      });
    }
  }

  function submit() {
    const body = content.trim();
    if (!body) {
      toast.error('Write a little something first');
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveFamilyMemoryAction({
          accountId,
          accountSlug,
          title: title.trim() || undefined,
          content: body,
          occurredAt,
          kind,
          childIds,
        });

        if (files.length > 0) {
          await attachFiles(result.noteId, files);
        }

        toast.success('Memory saved');
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(
          getUnknownErrorMessage(error, 'Could not save memory'),
        );
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle>Quick memory</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="memory-body">What happened</Label>
            <Textarea
              id="memory-body"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Poet said the moon was a biscuit…"
              rows={5}
              className="min-h-28"
            />
          </div>

          <MemoryVoiceRecorder
            disabled={isPending}
            keepRecording={keepRecording}
            onKeepRecordingChange={setKeepRecording}
            onTake={({ transcript, audio }) => {
              if (transcript) {
                setContent((current) =>
                  [current.trim(), transcript].filter(Boolean).join('\n\n'),
                );
              }
              if (audio) {
                try {
                  assertMemoryMedia({
                    mimeType: normalizeMemoryMimeType(audio.type, audio.name),
                    filename: audio.name,
                    size: audio.size,
                  });
                  setFiles((current) => [...current, audio].slice(0, 8));
                } catch (error) {
                  toast.error(
                    getUnknownErrorMessage(error, 'Could not keep that recording'),
                  );
                }
              }
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="memory-title">Title (optional)</Label>
            <Input
              id="memory-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Moon biscuit"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memory-date">When</Label>
            <Input
              id="memory-date"
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Who is in this memory</p>
            {children.length === 0 ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Add children from the Children page. Each child is a Person —
                memories attach to them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {children.map((person) => {
                  const active = childIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleChild(person.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                        active
                          ? `${workspaceFilterActive} border-transparent`
                          : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
                      }`}
                    >
                      <ChildAvatar
                        name={person.display_name}
                        url={person.avatarUrl}
                        size="sm"
                      />
                      {person.display_name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_KINDS.map((value) => {
                const active = kind === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKind(active ? null : value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      active
                        ? `${workspaceFilterActive} border-transparent`
                        : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]'
                    }`}
                  >
                    {MEMORY_KIND_LABELS[value]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Photos, video, voice notes</p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Up to {MEMORY_MEDIA_MAX_LABEL} each — the account-documents limit.
            </p>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label htmlFor="memory-visuals" className="text-xs font-normal">
                  Photos or video
                </Label>
                <Input
                  id="memory-visuals"
                  ref={visualInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov"
                  multiple
                  onChange={(event) => addFiles(event.target.files)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="memory-audio" className="text-xs font-normal">
                  Voice memo or audio file
                </Label>
                <Input
                  id="memory-audio"
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.m4a,.caf,.mp3,.wav,.aac"
                  multiple
                  onChange={(event) => addFiles(event.target.files)}
                />
              </div>
            </div>
            {files.length > 0 ? (
              <ul className="space-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>{fileLabel(file)}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            data-test="save-memory"
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : 'Save memory'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
