'use client';

import { useState } from 'react';

import { Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  type ContentPlatform,
  type ContentPost,
  type ContentStatus,
} from '~/lib/projects/content/content-calendar';

import type { ContentPostDraft } from './use-project-content';

type Target = { post: ContentPost } | { date: string } | null;

/** Add or edit one post. Remounts per target so the form starts fresh. */
export function ContentPostDialog({
  target,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  target: Target;
  canEdit: boolean;
  onClose: () => void;
  onSave: (draft: ContentPostDraft) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <PostForm
          key={'post' in target ? target.post.id : `new-${target.date}`}
          target={target}
          canEdit={canEdit}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function PostForm({
  target,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  target: NonNullable<Target>;
  canEdit: boolean;
  onClose: () => void;
  onSave: (draft: ContentPostDraft) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const existing = 'post' in target ? target.post : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(
    existing?.postDate ?? ('date' in target ? target.date : ''),
  );
  const [time, setTime] = useState(existing?.postTime ?? '');
  const [status, setStatus] = useState<ContentStatus>(
    existing?.status ?? 'idea',
  );
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(
    existing?.platforms ?? [],
  );
  const [body, setBody] = useState(existing?.body ?? '');
  const [linkUrl, setLinkUrl] = useState(existing?.linkUrl ?? '');
  const [saving, setSaving] = useState(false);

  const togglePlatform = (key: ContentPlatform) =>
    setPlatforms((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );

  async function submit() {
    if (!title.trim() || !date) return;
    setSaving(true);
    await onSave({
      id: existing?.id,
      postDate: date,
      postTime: time || null,
      title: title.trim(),
      body,
      status,
      platforms,
      linkUrl: linkUrl.trim() || null,
    });
    setSaving(false);
    onClose();
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit post' : 'New post'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            value={title}
            disabled={!canEdit}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What is the post?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="post-date">Date</Label>
            <Input
              id="post-date"
              type="date"
              value={date}
              disabled={!canEdit}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-time">Time (optional)</Label>
            <Input
              id="post-time"
              type="time"
              value={time}
              disabled={!canEdit}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_STATUSES.map((option) => {
              const active = status === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={active}
                  onClick={() => setStatus(option.key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    !active && 'opacity-60 hover:opacity-100',
                  )}
                  style={{
                    backgroundColor: active ? option.bg : 'transparent',
                    color: option.fg,
                    borderColor: option.fg,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Platforms</Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_PLATFORMS.map((option) => {
              const active = platforms.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={active}
                  onClick={() => togglePlatform(option.key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-transparent text-white'
                      : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                  )}
                  style={active ? { backgroundColor: option.color } : undefined}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-body">Script / caption</Label>
          <Textarea
            id="post-body"
            rows={6}
            value={body}
            disabled={!canEdit}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Caption, script or notes for this post"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-link">Link (optional)</Label>
          <Input
            id="post-link"
            value={linkUrl}
            disabled={!canEdit}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {existing && canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              await onDelete(existing.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              disabled={saving || !title.trim() || !date}
              onClick={submit}
            >
              {existing ? 'Save' : 'Add post'}
            </Button>
          ) : null}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
