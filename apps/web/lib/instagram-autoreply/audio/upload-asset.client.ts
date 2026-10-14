import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';

import { computePeaks } from '~/lib/videos/audio-waveform.client';

import { IG_ASSET_MAX_BYTES, IG_AUDIO_MAX_DURATION_MS } from './detect-format';

export type IgAssetKindClient = 'audio' | 'image' | 'video' | 'pdf';

export type IgAssetListItem = {
  id: string;
  label: string;
  kind: IgAssetKindClient;
  source: 'upload' | 'recording' | 'tts';
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  waveform: number[] | null;
  transcode_status: 'pending' | 'processing' | 'ready' | 'failed';
  transcode_error: string | null;
  created_at: string;
};

export const IG_WAVEFORM_BARS = 48;

/** Decode audio in the browser for a waveform preview and duration check. Best effort. */
export async function analyseAudioFile(
  file: Blob,
): Promise<{ peaks: number[] | null; durationMs: number | null }> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      const audio = await ctx.decodeAudioData(await file.arrayBuffer());
      return {
        peaks: computePeaks(audio.getChannelData(0), IG_WAVEFORM_BARS),
        durationMs: Math.round(audio.duration * 1000),
      };
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch {
    return { peaks: null, durationMs: null };
  }
}

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? fallback;
}

/**
 * Two-phase upload: create the asset + signed upload URL, upload straight to
 * Storage, then ask the server to validate and transcode.
 */
export async function uploadIgAsset(params: {
  accountId: string;
  kind: IgAssetKindClient;
  source: 'upload' | 'recording';
  label: string;
  file: Blob;
  waveform?: number[] | null;
}): Promise<IgAssetListItem> {
  const max = IG_ASSET_MAX_BYTES[params.kind];
  if (params.file.size > max) {
    throw new Error(
      `The file is too large. The maximum is ${Math.round(max / (1024 * 1024))} MB.`,
    );
  }

  let waveform = params.waveform ?? null;
  if (params.kind === 'audio') {
    const analysis = await analyseAudioFile(params.file);
    if (
      analysis.durationMs !== null &&
      analysis.durationMs > IG_AUDIO_MAX_DURATION_MS + 750
    ) {
      throw new Error('Voice notes must be 60 seconds or shorter.');
    }
    waveform = waveform ?? analysis.peaks;
  }

  const createRes = await fetch('/api/instagram-autoreply/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: params.accountId,
      kind: params.kind,
      source: params.source,
      label: params.label,
      sizeBytes: params.file.size,
      waveform,
    }),
  });
  if (!createRes.ok) {
    throw new Error(await readError(createRes, 'Could not start the upload'));
  }
  const created = (await createRes.json()) as {
    assetId: string;
    bucket: string;
    path: string;
    token: string;
  };

  const supabase = getSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from(created.bucket)
    .uploadToSignedUrl(created.path, created.token, params.file, {
      contentType: params.file.type || 'application/octet-stream',
    });
  if (uploadError) {
    throw new Error('Upload failed. Please try again.');
  }

  const processRes = await fetch(
    `/api/instagram-autoreply/assets/${created.assetId}/process`,
    { method: 'POST' },
  );
  if (!processRes.ok) {
    throw new Error(await readError(processRes, 'Could not process the file'));
  }
  const processed = (await processRes.json()) as { asset: IgAssetListItem };
  return processed.asset;
}

/** Generate a voice note from text. Media credits are charged once it's ready. */
export async function generateIgTtsAsset(params: {
  accountId: string;
  label: string;
  text: string;
  voice: string;
  customVoice: boolean;
  voiceCloneConsent: boolean;
}): Promise<IgAssetListItem> {
  const res = await fetch('/api/instagram-autoreply/assets/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await readError(res, 'Voice generation failed'));
  const data = (await res.json()) as { asset: IgAssetListItem };
  return data.asset;
}

export async function fetchIgAssetPreviewUrl(assetId: string) {
  const res = await fetch(`/api/instagram-autoreply/assets/${assetId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await readError(res, 'Preview unavailable'));
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function renameIgAsset(assetId: string, label: string) {
  const res = await fetch(`/api/instagram-autoreply/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Rename failed'));
}

export async function deleteIgAsset(assetId: string) {
  const res = await fetch(`/api/instagram-autoreply/assets/${assetId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await readError(res, 'Delete failed'));
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '–:––';
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
