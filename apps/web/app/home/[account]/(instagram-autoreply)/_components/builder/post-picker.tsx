'use client';

import { useEffect, useState, useTransition } from 'react';

import { Film, ImageIcon, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import type { IgMediaItem } from '~/lib/instagram-autoreply/graph-api';
import {
  workspaceBorder,
  workspaceCardHover,
  workspaceInsetSurface,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { listIgPostsForPicker } from '../../_lib/server/instagram-sequence-actions';

export function PostPicker(props: {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (item: IgMediaItem) => void;
}) {
  const [items, setItems] = useState<IgMediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!props.open || items) return;
    startLoading(async () => {
      try {
        setItems(await listIgPostsForPicker({ accountId: props.accountId }));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load posts');
      }
    });
  }, [props.open, props.accountId, items]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a post</DialogTitle>
          <DialogDescription>
            Your 30 most recent posts and reels.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            className={`flex items-center gap-2 py-10 text-sm ${workspaceTextMuted}`}
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading posts…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-[var(--destructive)]">{error}</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
            {(items ?? []).map((item) => {
              const selected = item.id === props.selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    props.onSelect(item);
                    props.onOpenChange(false);
                  }}
                  className={`group overflow-hidden rounded-xl border text-left ${workspaceBorder} ${workspaceCardHover} ${
                    selected ? 'ring-2 ring-[var(--ozer-accent)]' : ''
                  }`}
                >
                  <div
                    className={`relative aspect-square w-full ${workspaceInsetSurface}`}
                  >
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 opacity-50" aria-hidden />
                      </div>
                    )}
                    {item.mediaProductType === 'REELS' ? (
                      <Film
                        className="absolute top-2 right-2 h-4 w-4 text-[var(--ozer-white)] drop-shadow"
                        aria-label="Reel"
                      />
                    ) : null}
                  </div>
                  <p
                    className={`line-clamp-2 p-2 text-xs ${workspaceTextMuted}`}
                  >
                    {item.caption || 'No caption'}
                  </p>
                </button>
              );
            })}
            {items && items.length === 0 ? (
              <p className={`col-span-full py-6 text-sm ${workspaceTextMuted}`}>
                No posts found on this account.
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
