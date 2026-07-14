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
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import type { VideoFolderRow, VideoRow } from '~/lib/videos/types';

const NO_FOLDER = '__none__';

export function MoveToFolderDialog(props: {
  open: boolean;
  video: VideoRow | null;
  folders: VideoFolderRow[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (folderId: string | null) => Promise<void>;
}) {
  const [folderId, setFolderId] = useState(NO_FOLDER);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!props.open || !props.video) return;
    setFolderId(props.video.folder_id ?? NO_FOLDER);
  }, [props.open, props.video]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-sm">
            Choose a folder for{' '}
            <span className="font-medium text-[var(--workspace-shell-text)]">
              {props.video?.title}
            </span>
            .
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="move-folder">Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="move-folder">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                {props.folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            type="button"
            className="ozer-gradient-btn"
            disabled={pending || !props.video}
            onClick={() => {
              startTransition(async () => {
                await props.onConfirm(
                  folderId === NO_FOLDER ? null : folderId,
                );
              });
            }}
          >
            {pending ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
