'use client';

import { useEffect, useState, useTransition } from 'react';

import { Copy, Globe, Link2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import {
  getWorkspaceItemPublicLinkAction,
  setWorkspaceItemPublicAction,
} from '../../_lib/workspace-content/sharing-actions';

export function PublicSharingSection({
  accountId,
  accountSlug,
  itemType,
  itemId,
  isPublic: initialIsPublic,
  disabled,
}: {
  accountId: string;
  accountSlug: string;
  itemType: 'note' | 'file';
  itemId: string;
  isPublic: boolean;
  disabled?: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setIsPublic(initialIsPublic);
  }, [initialIsPublic]);

  useEffect(() => {
    if (!itemId || !initialIsPublic) {
      setPublicUrl(null);
      setEmbedUrl(null);
      return;
    }
    startTransition(async () => {
      try {
        const result = await getWorkspaceItemPublicLinkAction({
          accountId,
          itemType,
          itemId,
        });
        setPublicUrl(result.publicUrl);
        setEmbedUrl(result.embedUrl);
      } catch {
        /* ignore */
      }
    });
  }, [accountId, itemId, itemType, initialIsPublic]);

  const toggle = (next: boolean) => {
    startTransition(async () => {
      try {
        const result = await setWorkspaceItemPublicAction({
          accountId,
          accountSlug,
          itemType,
          itemId,
          isPublic: next,
        });
        setIsPublic(next);
        setPublicUrl(result.publicUrl);
        setEmbedUrl(result.embedUrl);
        toast.success(next ? 'Public link enabled' : 'Public link disabled');
      } catch {
        toast.error('Could not update sharing');
      }
    });
  };

  const copy = (url: string | null, label: string) => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          <Label className="text-[var(--workspace-shell-text)]">Public link</Label>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={toggle}
          disabled={disabled || pending || !itemId}
        />
      </div>
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Anyone with the link can view{textContent(itemType)}. Use embed URL for
        websites.
      </p>
      {isPublic && publicUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={publicUrl}
              className="min-w-0 flex-1 truncate rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-1.5 text-xs text-[var(--workspace-shell-text-muted)]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-[color:var(--workspace-shell-border)]"
              onClick={() => copy(publicUrl, 'Public URL')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          {embedUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-auto p-0 text-xs text-[var(--ozer-accent-muted)] hover:bg-transparent"
              onClick={() => copy(embedUrl, 'Embed URL')}
            >
              <Link2 className="mr-1 h-3 w-3" />
              Copy embed URL
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function textContent(itemType: 'note' | 'file') {
  return itemType === 'file' ? ' or download files' : '';
}
