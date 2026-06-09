'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  buildWhatsAppShareUrl,
} from '~/lib/videos/public-share';

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

export function PublicSharePanel(props: {
  videoId: string;
  videoTitle: string;
  initialEnabled: boolean;
  initialToken: string | null;
  initialPublicUrl: string | null;
  videoReady: boolean;
}) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [publicUrl, setPublicUrl] = useState(props.initialPublicUrl);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const whatsAppUrl = useMemo(() => {
    if (!publicUrl) return null;
    return buildWhatsAppShareUrl(`${props.videoTitle}\n${publicUrl}`);
  }, [props.videoTitle, publicUrl]);

  const updateShare = useCallback(
    async (nextEnabled: boolean) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/videos/${props.videoId}/public-share`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled }),
        });
        const json = (await res.json()) as ApiResponse;
        if (!json.ok) throw new Error(json.error.message);

        setEnabled(json.data.enabled);
        setPublicUrl(json.data.publicUrl);
        toast.success(
          json.data.enabled ? 'Public link enabled' : 'Public link disabled',
        );
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setSaving(false);
      }
    },
    [props.videoId],
  );

  const copyLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Public link</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Share a watch page on WhatsApp, email, or social media. Anyone with
            the link can view this video.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="public-share-enabled" className="text-xs">
            {enabled ? 'Enabled' : 'Disabled'}
          </Label>
          <Switch
            id="public-share-enabled"
            checked={enabled}
            disabled={saving || !props.videoReady}
            onCheckedChange={(value) => void updateShare(value)}
          />
        </div>
      </div>

      {!props.videoReady ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
          Public sharing unlocks once the video finishes processing.
        </p>
      ) : null}

      {enabled && publicUrl ? (
        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              value={publicUrl}
              className="min-w-[16rem] flex-1 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              size="sm"
              className="keel-gradient-btn gap-1.5"
              onClick={() => void copyLink()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--keel-teal)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {whatsAppUrl ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
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
              onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
            >
              Open public page
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
