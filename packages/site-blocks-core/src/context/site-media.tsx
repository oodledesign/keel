'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { SiteMediaImg, normalizeSiteMediaUrl } from './site-media-img';

export type SiteMediaUploader = (file: File) => Promise<string>;

export type SiteMediaItem = {
  url: string;
  path: string;
  name: string;
  updatedAt?: string | null;
};

export type SiteMediaContextValue = {
  upload: SiteMediaUploader;
  list: () => Promise<SiteMediaItem[]>;
};

const SiteMediaUploadContext = createContext<SiteMediaContextValue | null>(
  null,
);

export function SiteMediaUploadProvider({
  upload,
  list,
  children,
}: {
  upload: SiteMediaUploader;
  list?: () => Promise<SiteMediaItem[]>;
  children: ReactNode;
}) {
  const value = useMemo<SiteMediaContextValue>(
    () => ({
      upload,
      list: list ?? (async () => []),
    }),
    [upload, list],
  );

  return (
    <SiteMediaUploadContext.Provider value={value}>
      {children}
    </SiteMediaUploadContext.Provider>
  );
}

export function useSiteMedia() {
  return useContext(SiteMediaUploadContext);
}

export function useSiteMediaUploader() {
  return useContext(SiteMediaUploadContext)?.upload ?? null;
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
  const media = useSiteMedia();
  const upload = media?.upload ?? null;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<SiteMediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

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

  const openLibrary = useCallback(async () => {
    if (!media?.list) return;
    setShowLibrary(true);
    setLoadingLibrary(true);
    setError(null);
    try {
      setLibraryItems(await media.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load library');
    } finally {
      setLoadingLibrary(false);
    }
  }, [media]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">{label}</label>
      {value ? (
        <SiteMediaImg
          src={value}
          alt=""
          className="max-h-32 w-full rounded object-cover"
          fallbackClassName="flex max-h-32 min-h-20 w-full items-center justify-center rounded bg-[var(--sb-atmosphere,#e8e6e1)] text-xs text-[var(--sb-ink-muted,#6b6862)]"
        />
      ) : null}
      <input
        type="url"
        className="w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            normalizeSiteMediaUrl(event.target.value) ?? event.target.value,
          )
        }
        placeholder="https://…"
      />
      {upload ? (
        <label className="flex cursor-pointer flex-col gap-1">
          <span className="text-xs text-[var(--sb-ink-muted,#6b6862)]">
            {uploading
              ? 'Uploading…'
              : 'Upload image (PNG, JPG, WebP, AVIF, SVG — max 5 MB)'}
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
      {media?.list ? (
        <button
          type="button"
          className="text-xs font-medium text-[var(--ozer-accent,#FF5C34)] underline-offset-2 hover:underline"
          onClick={() => {
            if (showLibrary) {
              setShowLibrary(false);
              return;
            }
            void openLibrary();
          }}
        >
          {showLibrary ? 'Hide media library' : 'Choose from media library'}
        </button>
      ) : null}
      {showLibrary ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded border p-2">
          {loadingLibrary ? (
            <p className="text-xs text-[var(--sb-ink-muted,#6b6862)]">
              Loading…
            </p>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-[var(--sb-ink-muted,#6b6862)]">
              No uploads yet. Use the Media tab to add images.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {libraryItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  title={item.name}
                  onClick={() => {
                    onChange(item.url);
                    setShowLibrary(false);
                  }}
                  className="overflow-hidden rounded border border-transparent hover:border-[var(--ozer-accent,#FF5C34)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
