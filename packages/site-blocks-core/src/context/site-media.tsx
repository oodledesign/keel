'use client';

import { type ReactNode, createContext, useContext, useState } from 'react';

export type SiteMediaUploader = (file: File) => Promise<string>;

const SiteMediaUploadContext = createContext<SiteMediaUploader | null>(null);

export function SiteMediaUploadProvider({
  upload,
  children,
}: {
  upload: SiteMediaUploader | null;
  children: ReactNode;
}) {
  return (
    <SiteMediaUploadContext.Provider value={upload}>
      {children}
    </SiteMediaUploadContext.Provider>
  );
}

export function useSiteMediaUploader() {
  return useContext(SiteMediaUploadContext);
}

/** Puck custom field for image URLs; uses SiteMediaUploadProvider when present. */
export function SiteImageField({
  value,
  onChange,
  label = 'Image',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const upload = useSiteMediaUploader();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file || !upload) return;
    setUploading(true);
    setError(null);
    try {
      const url = await upload(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">{label}</label>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="max-h-32 w-full rounded object-cover"
        />
      ) : null}
      <input
        type="url"
        className="w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://…"
      />
      {upload ? (
        <label className="flex cursor-pointer flex-col gap-1">
          <span className="text-xs text-[var(--sb-ink-muted,#6b6862)]">
            {uploading ? 'Uploading…' : 'Upload image (PNG, JPG, WebP, AVIF, SVG — max 5 MB)'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
            disabled={uploading}
            className="text-xs"
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <p className="text-xs text-[var(--sb-ink-muted,#6b6862)]">
          Paste a URL above, or open this page in Site Studio to upload.
        </p>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
