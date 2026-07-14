'use client';

import { useState, useTransition } from 'react';

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

export function CreateFolderDialog(props: {
  open: boolean;
  parentFolderName?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setName('');
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || pending) return;
            startTransition(async () => {
              await props.onConfirm(trimmed);
              setName('');
            });
          }}
        >
          {props.parentFolderName ? (
            <p className="text-muted-foreground text-sm">
              Creating inside{' '}
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {props.parentFolderName}
              </span>
              .
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Create a top-level folder in your video library.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              autoFocus
              placeholder="e.g. Client case studies"
              onChange={(event) => setName(event.target.value)}
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
              disabled={pending || !name.trim()}
            >
              {pending ? 'Creating…' : 'Create folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
