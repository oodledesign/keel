'use client';

import { useCallback, useRef, useState } from 'react';

import { Loader2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { isSafeHttpUrl } from '~/lib/campaigns/campaign-document';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

type LibraryItem = {
  url: string;
  path: string;
  name: string;
  source: 'campaigns' | 'sites';
};

export function CampaignImagePicker({
  accountId,
  src,
  disabled,
  onChange,
}: {
  accountId?: string;
  src: string;
  disabled?: boolean;
  onChange: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const uploadFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !accountId || disabled) return;

      setUploading(true);
      try {
        const body = new FormData();
        body.set('accountId', accountId);
        body.set('file', file);
        const response = await fetch('/api/campaigns/media', {
          method: 'POST',
          body,
        });
        const payload = (await response.json()) as {
          url?: string;
          error?: string | { message?: string };
        };
        if (!response.ok || !payload.url) {
          throw new Error(mediaErrorMessage(payload.error, 'Upload failed'));
        }
        onChange(payload.url);
        toast.success('Image uploaded');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not upload image',
        );
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [accountId, disabled, onChange],
  );

  const openLibrary = useCallback(async () => {
    if (!accountId) return;
    setShowLibrary(true);
    setLoadingLibrary(true);
    try {
      const params = new URLSearchParams({ accountId });
      const response = await fetch(`/api/campaigns/media?${params.toString()}`);
      const payload = (await response.json()) as {
        items?: LibraryItem[];
        error?: string | { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          mediaErrorMessage(payload.error, 'Could not load workspace files'),
        );
      }
      setLibraryItems(payload.items ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not load workspace files',
      );
    } finally {
      setLoadingLibrary(false);
    }
  }, [accountId]);

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Image URL</Label>
        <Input
          value={src}
          disabled={disabled}
          placeholder="https://"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>

      {src && isSafeHttpUrl(src) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="max-h-24 w-full rounded-lg object-contain"
        />
      ) : null}

      {accountId ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs"
            disabled={disabled}
            onClick={() => {
              if (showLibrary) {
                setShowLibrary(false);
                return;
              }
              void openLibrary();
            }}
          >
            {showLibrary ? 'Hide files' : 'Workspace files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => void uploadFile(event.target.files?.[0])}
          />
        </div>
      ) : (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Paste a public image URL. Upload is available in a workspace campaign.
        </p>
      )}

      {showLibrary ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-2">
          {loadingLibrary ? (
            <p className={`text-xs ${workspaceTextMuted}`}>Loading…</p>
          ) : libraryItems.length === 0 ? (
            <p className={`text-xs ${workspaceTextMuted}`}>
              No workspace images yet. Upload one to reuse it here.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {libraryItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  title={item.name}
                  disabled={disabled}
                  onClick={() => {
                    onChange(item.url);
                    setShowLibrary(false);
                  }}
                  className="overflow-hidden rounded-lg border border-transparent hover:border-[var(--ozer-accent)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <span
                    className={`block truncate px-1 py-0.5 text-[10px] ${workspaceText}`}
                  >
                    {item.source === 'campaigns' ? 'Campaigns' : 'Sites'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <p className={`text-xs ${workspaceTextMuted}`}>
        Uploads are stored as a public URL so the sent email can load the image.
      </p>
    </div>
  );
}

function mediaErrorMessage(
  error: string | { message?: string } | undefined,
  fallback: string,
) {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && error.message?.trim()) {
    return error.message;
  }
  return fallback;
}
