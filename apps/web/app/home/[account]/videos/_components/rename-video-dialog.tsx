'use client';

import { useEffect, useState, useTransition } from 'react';

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

import type { VideoRow } from '~/lib/videos/types';

export function RenameVideoDialog(props: {
  video: VideoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(props.video?.title ?? '');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (props.open && props.video) {
      setTitle(props.video.title);
    }
  }, [props.open, props.video]);

  const trimmed = title.trim();
  const unchanged = trimmed === (props.video?.title ?? '').trim();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename video</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed || unchanged || pending) return;
            startTransition(async () => {
              await props.onConfirm(trimmed);
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rename-video-title">Video name</Label>
            <Input
              id="rename-video-title"
              value={title}
              autoFocus
              maxLength={500}
              onChange={(event) => setTitle(event.target.value)}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="ozer-gradient-btn"
              disabled={pending || !trimmed || unchanged}
            >
              {pending ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
