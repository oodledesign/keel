'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Plugin } from '@puckeditor/core';
import { Images, Loader2, Upload } from 'lucide-react';

import { type SiteMediaItem, useSiteMedia } from '@kit/site-blocks-core';

function SiteMediaLibraryPanel() {
  const media = useSiteMedia();
  const [items, setItems] = useState<SiteMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!media?.list) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await media.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load media');
    } finally {
      setLoading(false);
    }
  }, [media]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onFiles(files: FileList | null) {
    if (!files?.length || !media?.upload) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await media.upload(file);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl(item: SiteMediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedPath(item.path);
      window.setTimeout(() => setCopiedPath(null), 1500);
    } catch {
      setError('Could not copy URL');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div>
        <p className="text-sm font-semibold text-[var(--workspace-shell-text,#111)]">
          Media library
        </p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted,#666)]">
          Upload images for this site, then pick them from any image field.
        </p>
      </div>

      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[color:var(--workspace-shell-border,#ddd)] bg-[var(--workspace-shell-panel,#fff)] px-3 py-2 text-xs font-medium hover:bg-[var(--workspace-shell-sidebar-accent,#f7f7f5)]">
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {uploading ? 'Uploading…' : 'Upload images'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
          multiple
          disabled={uploading || !media?.upload}
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </label>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted,#666)]">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted,#666)]">
            No images yet. Upload a few to reuse across blocks.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => void copyUrl(item)}
                className="group overflow-hidden rounded-md border border-[color:var(--workspace-shell-border,#ddd)] text-left"
                title="Click to copy URL"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-1.5 py-1 text-[10px] text-[var(--workspace-shell-text-muted,#666)]">
                  {copiedPath === item.path ? 'Copied URL' : item.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function createSiteMediaLibraryPlugin(): Plugin {
  return {
    name: 'site-media',
    label: 'Media',
    icon: <Images size={16} />,
    render: () => <SiteMediaLibraryPanel />,
  };
}
