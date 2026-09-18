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

import { registerUploadedWorkspaceDocAction } from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
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
import { saveFamilyMemoryAction } from '../_lib/server/family-memories-actions';
import type { FamilyMemoryChild } from '../_lib/server/family-memories.loader';
import { ChildAvatar } from './child-avatar';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIsoDate());
  const [kind, setKind] = useState<MemoryKind | null>(null);
  const [childIds, setChildIds] = useState<string[]>(defaultChildIds);
  const [files, setFiles] = useState<File[]>([]);

  const children = people.filter((person) => person.is_child);

  useEffect(() => {
    if (!open) return;
    setContent('');
    setTitle('');
    setOccurredAt(todayIsoDate());
    setKind(null);
    setChildIds(defaultChildIds);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, defaultChildIds]);

  function toggleChild(id: string) {
    setChildIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    setFiles((current) => [...current, ...Array.from(list)].slice(0, 8));
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

        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${accountId}/memories/${Date.now()}_${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from(ACCOUNT_DOCS_BUCKET)
            .upload(filePath, file, { upsert: false });
          if (uploadError) throw uploadError;

          await registerUploadedWorkspaceDocAction({
            accountId,
            accountSlug,
            title: file.name,
            docType: 'general',
            tags: ['memory'],
            link: null,
            filePath,
            mimeType: file.type || null,
            fileSizeBytes: file.size,
            noteId: result.noteId,
          });
        }

        toast.success('Memory saved');
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save memory',
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

          <div className="space-y-1.5">
            <Label htmlFor="memory-media">Photos or videos</Label>
            <Input
              id="memory-media"
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => onFiles(event.target.files)}
            />
            {files.length > 0 ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {files.length} file{files.length === 1 ? '' : 's'} ready to
                attach
              </p>
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
