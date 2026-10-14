import {
  type DetectedFormat,
  FORMAT_EXTENSION,
  type IgAssetKind,
  isAudioTooLong,
  mimeForKind,
} from './detect-format';

export const IG_ASSETS_BUCKET = 'ig-automation-assets';

export type IgAssetPatch = {
  transcode_status?: 'pending' | 'processing' | 'ready' | 'failed';
  transcode_error?: string | null;
  original_path?: string;
  original_mime_type?: string;
  delivery_path?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_ms?: number | null;
};

export type ProcessAssetDeps = {
  upload: (path: string, bytes: Buffer, contentType: string) => Promise<void>;
  updateAsset: (patch: IgAssetPatch) => Promise<void>;
  transcode: (
    input: Buffer,
    inputExtension: string,
  ) => Promise<{ output: Buffer; durationMs: number }>;
};

export type ProcessAssetResult =
  | { status: 'ready'; durationMs: number | null; deliveryPath: string }
  | { status: 'failed'; error: string };

/** Where the browser uploads before validation; removed after processing. */
export function incomingAssetPath(accountId: string, assetId: string) {
  return `${accountId}/incoming/${assetId}`;
}

export function originalAssetPath(
  accountId: string,
  assetId: string,
  format: DetectedFormat,
) {
  return `${accountId}/originals/${assetId}.${FORMAT_EXTENSION[format]}`;
}

export function deliveryAssetPath(
  accountId: string,
  assetId: string,
  extension: string,
) {
  return `${accountId}/delivery/${assetId}.${extension}`;
}

/**
 * Store the original, then (for audio) transcode to an m4a delivery copy.
 * Every outcome is written to the asset row's transcode_status.
 */
export async function processIgAssetUpload(
  deps: ProcessAssetDeps,
  params: {
    accountId: string;
    assetId: string;
    kind: IgAssetKind;
    format: DetectedFormat;
    bytes: Buffer;
  },
): Promise<ProcessAssetResult> {
  const originalMime = mimeForKind(params.kind, params.format);
  const originalPath = originalAssetPath(
    params.accountId,
    params.assetId,
    params.format,
  );

  try {
    await deps.updateAsset({ transcode_status: 'processing' });
    await deps.upload(originalPath, params.bytes, originalMime);
    await deps.updateAsset({
      original_path: originalPath,
      original_mime_type: originalMime,
    });

    if (params.kind !== 'audio') {
      await deps.updateAsset({
        transcode_status: 'ready',
        transcode_error: null,
        delivery_path: originalPath,
        mime_type: originalMime,
        size_bytes: params.bytes.length,
      });
      return { status: 'ready', durationMs: null, deliveryPath: originalPath };
    }

    const { output, durationMs } = await deps.transcode(
      params.bytes,
      FORMAT_EXTENSION[params.format],
    );

    if (isAudioTooLong(durationMs)) {
      const error = 'Voice notes must be 60 seconds or shorter.';
      await deps.updateAsset({
        transcode_status: 'failed',
        transcode_error: error,
        duration_ms: durationMs,
      });
      return { status: 'failed', error };
    }

    const deliveryPath = deliveryAssetPath(
      params.accountId,
      params.assetId,
      'm4a',
    );
    await deps.upload(deliveryPath, output, 'audio/mp4');
    await deps.updateAsset({
      transcode_status: 'ready',
      transcode_error: null,
      delivery_path: deliveryPath,
      mime_type: 'audio/mp4',
      size_bytes: output.length,
      duration_ms: durationMs,
    });

    return { status: 'ready', durationMs, deliveryPath };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Asset processing failed';
    await deps
      .updateAsset({ transcode_status: 'failed', transcode_error: message })
      .catch(() => undefined);
    return { status: 'failed', error: message };
  }
}
