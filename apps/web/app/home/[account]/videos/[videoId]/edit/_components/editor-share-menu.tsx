'use client';

import { useState } from 'react';

import {
  Code2,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Share2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { copyTextToClipboard } from '~/lib/clipboard';
import { buildWhatsAppShareUrl } from '~/lib/videos/public-share';

type PublicShareResponse =
  | { ok: true; data: { enabled: boolean; publicUrl: string | null } }
  | { ok: false; error?: { message?: string } };

type PlayerConfigResponse =
  | { ok: true; data: { embedIframe: string } }
  | { ok: false; error?: { message?: string } };

export function EditorShareMenu(props: {
  videoId: string;
  videoTitle: string;
  videoReady: boolean;
  initialPublicUrl: string | null;
}) {
  const [publicUrl, setPublicUrl] = useState(props.initialPublicUrl);
  const [busy, setBusy] = useState(false);

  async function enableAndCopyPublicLink() {
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/public-share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      const json = (await res.json()) as PublicShareResponse;
      if (!json.ok) {
        throw new Error(json.error?.message ?? 'Could not turn on public link');
      }
      if (!json.data.publicUrl) throw new Error('Public link unavailable');
      setPublicUrl(json.data.publicUrl);
      try {
        await copyTextToClipboard(json.data.publicUrl);
        toast.success('Public link turned on and copied');
      } catch {
        toast.success('Public link turned on — use “Copy public link”');
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyPublicLink() {
    if (!publicUrl) return;
    try {
      await copyTextToClipboard(publicUrl);
      toast.success('Public link copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function copyEmbedCode() {
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/player-config`);
      const json = (await res.json()) as PlayerConfigResponse;
      if (!json.ok) {
        throw new Error(json.error?.message ?? 'Failed to load embed code');
      }
      await copyTextToClipboard(json.data.embedIframe);
      toast.success('Embed code copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="mr-1.5 h-4 w-4" />
          )}
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {publicUrl ? (
          <>
            <DropdownMenuItem onClick={() => void copyPublicLink()}>
              <Link2 className="mr-2 h-4 w-4" />
              Copy public link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open public page
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={buildWhatsAppShareUrl(
                  `${props.videoTitle}\n${publicUrl}`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Share on WhatsApp
              </a>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            disabled={!props.videoReady}
            onClick={() => void enableAndCopyPublicLink()}
          >
            <Link2 className="mr-2 h-4 w-4" />
            {props.videoReady
              ? 'Turn on public link & copy'
              : 'Public link available once processed'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void copyEmbedCode()}>
          <Code2 className="mr-2 h-4 w-4" />
          Copy embed code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
