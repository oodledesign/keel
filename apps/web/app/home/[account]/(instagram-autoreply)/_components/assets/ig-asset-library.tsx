'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Pause,
  Pencil,
  Play,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  type IgAssetKindClient,
  type IgAssetListItem,
  deleteIgAsset,
  fetchIgAssetPreviewUrl,
  formatDuration,
  renameIgAsset,
  uploadIgAsset,
} from '~/lib/instagram-autoreply/audio/upload-asset.client';
import {
  workspaceBtnPrimaryMd,
  workspaceCardHover,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { listIgAssets } from '../../_lib/server/instagram-automation-actions';
import { IgAudioRecorder } from './ig-audio-recorder';
import { IgTtsGenerator } from './ig-tts-generator';
import { IgWaveform } from './ig-waveform';

const KIND_LABEL: Record<IgAssetKindClient, string> = {
  audio: 'voice note',
  image: 'image',
  video: 'video',
  pdf: 'PDF',
};

const KIND_ACCEPT: Record<IgAssetKindClient, string> = {
  audio: 'audio/*',
  image: 'image/png,image/jpeg',
  video: 'video/mp4,video/quicktime,video/webm',
  pdf: 'application/pdf',
};

function KindIcon({ kind }: { kind: IgAssetKindClient }) {
  if (kind === 'image') return <ImageIcon className="h-4 w-4" />;
  if (kind === 'video') return <Video className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

type IgAssetLibraryProps = {
  accountId: string;
  kind: IgAssetKindClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: IgAssetListItem) => void;
  selectedId?: string | null;
};

export function IgAssetLibrary({
  accountId,
  kind,
  open,
  onOpenChange,
  onSelect,
  selectedId,
}: IgAssetLibraryProps) {
  const [assets, setAssets] = useState<IgAssetListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listIgAssets({ accountId, kind });
      setAssets(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load files');
    } finally {
      setLoading(false);
    }
  }, [accountId, kind]);

  useEffect(() => {
    if (open) void load();
    if (!open) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }, [open, load]);

  async function togglePlay(asset: IgAssetListItem) {
    if (playingId === asset.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      const url = await fetchIgAssetPreviewUrl(asset.id);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(asset.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playback failed');
    }
  }

  async function commitRename(assetId: string) {
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value) return;
    try {
      await renameIgAsset(assetId, value);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, label: value } : a)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  async function remove(assetId: string) {
    try {
      await deleteIgAsset(assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const asset = await uploadIgAsset({
        accountId,
        kind,
        source: 'upload',
        label: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Untitled',
        file,
      });
      setAssets((prev) => [asset, ...prev]);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a {KIND_LABEL[kind]}</DialogTitle>
          <DialogDescription>
            Files are stored privately and only shared with Instagram at the
            moment a message is sent.
          </DialogDescription>
        </DialogHeader>

        {kind === 'audio' ? (
          <div className="space-y-3">
            <IgAudioRecorder
              accountId={accountId}
              onSaved={(asset) => setAssets((prev) => [asset, ...prev])}
            />
            <IgTtsGenerator
              accountId={accountId}
              onSaved={(asset) => setAssets((prev) => [asset, ...prev])}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload {KIND_LABEL[kind]}
            </Button>
            <span className={`text-xs ${workspaceTextMuted}`}>
              {kind === 'image' ? 'PNG or JPEG, up to 8 MB' : 'Up to 25 MB'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={KIND_ACCEPT[kind]}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void uploadFile(file);
              }}
            />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Library</p>
          {loading ? (
            <p className={`text-sm ${workspaceTextMuted}`}>Loading…</p>
          ) : assets.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>Nothing here yet.</p>
          ) : (
            <ul className="space-y-2">
              {assets.map((asset) => {
                const ready = asset.transcode_status === 'ready';
                return (
                  <li
                    key={asset.id}
                    className={`flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 ${workspaceCardHover} ${
                      selectedId === asset.id
                        ? 'border-[var(--ozer-accent)]'
                        : ''
                    }`}
                  >
                    {asset.kind === 'audio' ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0 rounded-full"
                        onClick={() => void togglePlay(asset)}
                        disabled={!ready}
                        aria-label={playingId === asset.id ? 'Pause' : 'Play'}
                      >
                        {playingId === asset.id ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-control-surface)]">
                        <KindIcon kind={asset.kind} />
                      </span>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      {renamingId === asset.id ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          maxLength={120}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void commitRename(asset.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void commitRename(asset.id);
                            }
                          }}
                          className="h-7"
                        />
                      ) : (
                        <p className="truncate text-sm font-medium">
                          {asset.label}
                        </p>
                      )}
                      {asset.kind === 'audio' ? (
                        <div className="flex items-center gap-2">
                          <IgWaveform
                            peaks={asset.waveform}
                            className="h-5 flex-1 overflow-hidden"
                          />
                          <span
                            className={`text-xs tabular-nums ${workspaceTextMuted}`}
                          >
                            {formatDuration(asset.duration_ms)}
                          </span>
                        </div>
                      ) : null}
                      {!ready ? (
                        <Badge variant="outline" className="text-xs">
                          {asset.transcode_status === 'failed'
                            ? (asset.transcode_error ?? 'Failed')
                            : 'Processing'}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Rename"
                        onClick={() => {
                          setRenamingId(asset.id);
                          setRenameValue(asset.label);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Delete"
                        onClick={() => void remove(asset.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!ready}
                        onClick={() => {
                          onSelect(asset);
                          onOpenChange(false);
                        }}
                      >
                        Use
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
