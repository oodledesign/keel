'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { displayLinkHostname } from '~/lib/workspace-links/link-metadata';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  createWorkspaceLinkAction,
  fetchWorkspaceLinkMetadataAction,
} from '../../_lib/workspace-content/links-actions';
import type { SavedLinkListItem } from '../../_lib/workspace-content/types';
import type { LinkValue } from './link-to-select';
import { WorkspaceLinkIcon } from './workspace-link-icon';

export function AddWorkspaceLinkDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  personalScope = false,
  defaultLink = null,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  personalScope?: boolean;
  defaultLink?: LinkValue;
  onCreated: (link: SavedLinkListItem) => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [pending, startTransition] = useTransition();
  const fetchedFor = useRef('');

  useEffect(() => {
    if (!open) {
      setUrl('');
      setTitle('');
      setDescription('');
      setFaviconUrl(null);
      setOgImageUrl(null);
      fetchedFor.current = '';
    }
  }, [open]);

  async function fillFromUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || fetchedFor.current === trimmed) return;

    setFetching(true);
    try {
      const meta = await fetchWorkspaceLinkMetadataAction({ url: trimmed });
      fetchedFor.current = trimmed;
      setUrl(meta.url);
      setTitle((current) => current.trim() || meta.title);
      setDescription((current) => current.trim() || meta.description);
      setFaviconUrl(meta.faviconUrl);
      setOgImageUrl(meta.ogImageUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not read that URL',
      );
    } finally {
      setFetching(false);
    }
  }

  function save() {
    if (!url.trim()) {
      toast.error('Paste a link first');
      return;
    }

    const contextLink =
      defaultLink &&
      defaultLink.type !== 'instruction' &&
      defaultLink.type !== 'requirement'
        ? defaultLink
        : null;

    startTransition(async () => {
      try {
        const { link } = await createWorkspaceLinkAction({
          accountId,
          accountSlug,
          personalScope,
          title: title.trim() || displayLinkHostname(url),
          url,
          description,
          faviconUrl,
          ogImageUrl,
          link: contextLink,
        });
        toast.success('Link saved');
        onCreated(link);
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save link',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-link-url">URL</Label>
            <Input
              id="workspace-link-url"
              value={url}
              autoFocus
              placeholder="https://docs.google.com/…"
              onChange={(event) => setUrl(event.target.value)}
              onBlur={() => void fillFromUrl(url)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text');
                if (pasted) {
                  window.setTimeout(() => void fillFromUrl(pasted), 0);
                }
              }}
            />
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {fetching
                ? 'Fetching title and description…'
                : 'Title and description fill in automatically from the page.'}
            </p>
          </div>

          {(faviconUrl || ogImageUrl || title) && url ? (
            <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
              {ogImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Open Graph preview
                <img
                  src={ogImageUrl}
                  alt=""
                  className="h-28 w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="flex items-center gap-3 p-3">
                <WorkspaceLinkIcon
                  url={url}
                  faviconUrl={faviconUrl}
                  title={title || 'Link'}
                />
                <p className="truncate text-sm text-[var(--workspace-shell-text-muted)]">
                  {displayLinkHostname(url)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="workspace-link-title">Title</Label>
            <Input
              id="workspace-link-title"
              value={title}
              placeholder="Page title"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="workspace-link-description">Description</Label>
            <Textarea
              id="workspace-link-description"
              value={description}
              rows={3}
              placeholder="Optional"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={pending || fetching || !url.trim()}
            onClick={save}
          >
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
