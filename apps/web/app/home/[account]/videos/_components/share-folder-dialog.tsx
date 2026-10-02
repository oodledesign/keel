'use client';

import { useEffect, useMemo, useState } from 'react';

import { Check, Copy, MessageCircle } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { copyTextToClipboard } from '~/lib/clipboard';
import {
  buildPublicFolderWatchUrl,
  buildWhatsAppShareUrl,
} from '~/lib/videos/public-share';
import type { VideoFolderRow } from '~/lib/videos/types';

type ApiResponse =
  | {
      ok: true;
      data: {
        enabled: boolean;
        token: string | null;
        publicUrl: string | null;
      };
    }
  | { ok: false; error: { message: string } };

function initialUrl(folder: VideoFolderRow | null) {
  return folder?.public_share_enabled && folder.public_share_token
    ? buildPublicFolderWatchUrl(folder.public_share_token)
    : null;
}

export function ShareFolderDialog(props: {
  open: boolean;
  folder: VideoFolderRow | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the share state changes so the library can refresh. */
  onChanged: () => void;
}) {
  const { folder } = props;
  const [enabled, setEnabled] = useState(Boolean(folder?.public_share_enabled));
  const [publicUrl, setPublicUrl] = useState<string | null>(initialUrl(folder));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-sync when a different folder is opened or the library refreshes.
  useEffect(() => {
    setEnabled(Boolean(folder?.public_share_enabled));
    setPublicUrl(initialUrl(folder));
    setCopied(false);
  }, [folder]);

  const whatsAppUrl = useMemo(
    () =>
      publicUrl && folder
        ? buildWhatsAppShareUrl(`${folder.name}\n${publicUrl}`)
        : null,
    [folder, publicUrl],
  );

  if (!folder) return null;

  const updateShare = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/folders/${folder.id}/public-share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) throw new Error(json.error.message);

      setEnabled(json.data.enabled);
      setPublicUrl(json.data.publicUrl);
      toast.success(
        json.data.enabled ? 'Folder link enabled' : 'Folder link disabled',
      );
      props.onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;

    try {
      await copyTextToClipboard(publicUrl);
      setCopied(true);
      toast.success('Link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{folder.name}”</DialogTitle>
          <DialogDescription>
            Anyone with the link can watch the ready videos in this folder and
            its subfolders. No sign-in needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="folder-public-share" className="text-sm">
              {enabled ? 'Public link enabled' : 'Public link disabled'}
            </Label>
            <Switch
              id="folder-public-share"
              checked={enabled}
              disabled={saving}
              onCheckedChange={(value) => void updateShare(value)}
            />
          </div>

          {enabled && publicUrl ? (
            <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  readOnly
                  value={publicUrl}
                  className="min-w-[14rem] flex-1 font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  size="sm"
                  className="ozer-gradient-btn gap-1.5"
                  onClick={() => void copyLink()}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {whatsAppUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    asChild
                  >
                    <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Share on WhatsApp
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(publicUrl, '_blank', 'noopener,noreferrer')
                  }
                >
                  Open public page
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Videos still processing aren’t shown. Turning the link off stops it
            working straight away; turning it back on restores the same link.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
