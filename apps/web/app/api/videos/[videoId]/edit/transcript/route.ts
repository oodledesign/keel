import { after } from 'next/server';
import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { VideoTranscriptWord } from '~/lib/videos/edit-timeline';
import {
  bunnyCaptionKeepRanges,
  syncTranscriptCaptionsToBunny,
} from '~/lib/videos/server/sync-bunny-captions';
import { createSignedMasterUrl } from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';
import { replaceTranscriptWords } from '~/lib/videos/transcript-edit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const ManualSchema = z.object({
  plainText: z.string(),
  words: z.array(
    z.object({
      text: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      confidence: z.number().nullable().optional(),
    }),
  ),
});

export async function GET(_request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data } = await access.client
    .from('video_transcripts')
    .select('*')
    .eq('video_id', videoId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    transcript: data
      ? {
          plainText: data.plain_text as string,
          words: (data.words ?? []) as VideoTranscriptWord[],
          status: data.status as string,
          provider: data.provider as string | null,
        }
      : null,
  });
}

/**
 * Generate or save a word-timed transcript.
 * Uses OpenAI Whisper-compatible timing when OPENAI_API_KEY is set;
 * otherwise accepts a manual body for testing.
 */
export async function POST(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const video = access.video!;
  const contentType = request.headers.get('content-type') ?? '';

  let plainText = '';
  let words: VideoTranscriptWord[] = [];
  let provider = 'manual';

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => null);
    const parsed = ManualSchema.safeParse(json);
    if (parsed.success) {
      plainText = parsed.data.plainText;
      words = parsed.data.words;
    } else {
      // Trigger auto transcription
      const result = await transcribeMaster(access.client, videoId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      plainText = result.plainText;
      words = result.words;
      provider = result.provider;
    }
  } else {
    const result = await transcribeMaster(access.client, videoId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    plainText = result.plainText;
    words = result.words;
    provider = result.provider;
  }

  const { data, error } = await access.client
    .from('video_transcripts')
    .upsert(
      {
        video_id: videoId,
        account_id: video.account_id,
        plain_text: plainText,
        words,
        provider,
        status: 'ready',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'video_id' },
    )
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    transcript: {
      plainText: data.plain_text,
      words: data.words,
      status: data.status,
      provider: data.provider,
    },
  });
}

const EditSchema = z
  .object({
    fromIndex: z.number().int().nonnegative(),
    toIndex: z.number().int().nonnegative(),
    text: z.string().trim().min(1).max(1000),
    /** The selection as the client saw it, so a stale transcript isn't edited by index. */
    expectedText: z.string().max(5000),
  })
  .refine((v) => v.toIndex >= v.fromIndex, {
    message: 'toIndex must be >= fromIndex',
  });

/** Correct the text of a run of words, keeping their timings. */
export async function PATCH(request: Request, context: RouteContext) {
  const { videoId } = await context.params;
  const access = await requireVideoById(videoId);
  if (access.error === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (access.error === 'NOT_FOUND' || access.error === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const parsed = EditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: current } = await access.client
    .from('video_transcripts')
    .select('plain_text, words, provider, status')
    .eq('video_id', videoId)
    .maybeSingle();

  const words = (current?.words ?? []) as VideoTranscriptWord[];
  if (!current || words.length === 0) {
    return NextResponse.json(
      { error: 'No transcript to edit' },
      { status: 404 },
    );
  }
  if (parsed.data.toIndex >= words.length) {
    return NextResponse.json(
      { error: 'Selection is outside the transcript' },
      { status: 400 },
    );
  }
  const currentText = words
    .slice(parsed.data.fromIndex, parsed.data.toIndex + 1)
    .map((w) => w.text.trim())
    .join(' ');
  if (currentText !== parsed.data.expectedText.trim()) {
    return NextResponse.json(
      {
        error:
          'The transcript changed since you loaded it. Refresh and try again.',
      },
      { status: 409 },
    );
  }

  const edited = replaceTranscriptWords({
    words,
    plainText: String(current.plain_text ?? ''),
    fromIndex: parsed.data.fromIndex,
    toIndex: parsed.data.toIndex,
    text: parsed.data.text,
  });

  const { data, error } = await access.client
    .from('video_transcripts')
    .update({
      words: edited.words,
      plain_text: edited.plainText,
      updated_at: new Date().toISOString(),
    })
    .eq('video_id', videoId)
    .select('plain_text, words, provider, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const video = access.video!;
  const captionTiming = bunnyCaptionKeepRanges(video);
  // Only refresh Stream captions once it holds the published edit, where timing is known.
  if (
    captionTiming.ok &&
    Number(video.baked_revision ?? 0) > 0 &&
    video.bunny_library_id &&
    video.bunny_video_id
  ) {
    const admin = getSupabaseServerAdminClient();
    after(async () => {
      try {
        await syncTranscriptCaptionsToBunny({
          client: admin,
          videoId,
          accountId: video.account_id as string,
          bunnyLibraryId: String(video.bunny_library_id),
          bunnyVideoId: String(video.bunny_video_id),
          keepRanges: captionTiming.keepRanges,
        });
      } catch (err) {
        console.warn('[videos/edit/transcript] caption sync failed:', err);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    transcript: {
      plainText: data.plain_text,
      words: data.words,
      status: data.status,
      provider: data.provider,
    },
  });
}

async function transcribeMaster(
  client: SupabaseClient,
  videoId: string,
): Promise<
  | {
      ok: true;
      plainText: string;
      words: VideoTranscriptWord[];
      provider: string;
    }
  | { ok: false; error: string }
> {
  const { data: master } = await client
    .from('video_masters')
    .select('storage_path, mic_storage_path')
    .eq('video_id', videoId)
    .maybeSingle();

  const row = master as {
    storage_path?: string;
    mic_storage_path?: string | null;
  } | null;
  if (!row?.storage_path) {
    return { ok: false, error: 'No master available for transcription' };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        'OPENAI_API_KEY is not configured. Pass manual words, or set the key for Whisper transcription.',
    };
  }

  try {
    const media = await downloadTranscriptionAudio(row);
    if (!media.ok) {
      return media;
    }
    const form = new FormData();
    form.append('file', media.blob, media.filename);
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    const sttRes = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );

    if (!sttRes.ok) {
      const text = await sttRes.text();
      return { ok: false, error: `Whisper failed: ${text.slice(0, 300)}` };
    }

    const payload = (await sttRes.json()) as {
      text?: string;
      words?: Array<{ word?: string; start?: number; end?: number }>;
      segments?: Array<{
        text?: string;
        start?: number;
        end?: number;
        words?: Array<{ word?: string; start?: number; end?: number }>;
      }>;
    };

    const words: VideoTranscriptWord[] = [];
    if (Array.isArray(payload.words) && payload.words.length) {
      for (const w of payload.words) {
        words.push({
          text: String(w.word ?? ''),
          startMs: Math.round((w.start ?? 0) * 1000),
          endMs: Math.round((w.end ?? 0) * 1000),
        });
      }
    } else if (Array.isArray(payload.segments)) {
      for (const seg of payload.segments) {
        if (Array.isArray(seg.words)) {
          for (const w of seg.words) {
            words.push({
              text: String(w.word ?? ''),
              startMs: Math.round((w.start ?? 0) * 1000),
              endMs: Math.round((w.end ?? 0) * 1000),
            });
          }
        } else if (seg.text) {
          words.push({
            text: seg.text.trim(),
            startMs: Math.round((seg.start ?? 0) * 1000),
            endMs: Math.round((seg.end ?? 0) * 1000),
          });
        }
      }
    }

    return {
      ok: true,
      plainText: payload.text?.trim() || words.map((w) => w.text).join(' '),
      words,
      provider: 'openai-whisper',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Transcription failed',
    };
  }
}

/** OpenAI caps the whole request at 25 MiB; leave headroom for the multipart fields. */
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

/**
 * Prefers the mic-only sidecar (small, voice only, same timeline as the master),
 * falling back to the master when it fits under Whisper's upload limit.
 */
async function downloadTranscriptionAudio(row: {
  storage_path?: string;
  mic_storage_path?: string | null;
}): Promise<
  { ok: true; blob: Blob; filename: string } | { ok: false; error: string }
> {
  const candidates = [
    row.mic_storage_path
      ? { path: row.mic_storage_path, filename: 'mic.m4a' }
      : null,
    row.storage_path
      ? { path: row.storage_path, filename: 'master.mp4' }
      : null,
  ].filter((c): c is { path: string; filename: string } => c !== null);

  let oversizedBytes: number | null = null;

  for (const candidate of candidates) {
    let signedUrl: string;
    try {
      signedUrl = await createSignedMasterUrl(candidate.path, 60 * 30);
    } catch {
      continue;
    }

    const res = await fetch(signedUrl);
    if (!res.ok) {
      await res.body?.cancel();
      continue;
    }

    const contentLength = res.headers.get('content-length');
    const declared = contentLength === null ? null : Number(contentLength);
    if (declared !== null && declared > WHISPER_MAX_BYTES) {
      await res.body?.cancel();
      oversizedBytes = declared;
      continue;
    }

    const blob = await res.blob();
    if (blob.size > WHISPER_MAX_BYTES) {
      oversizedBytes = blob.size;
      continue;
    }
    return { ok: true, blob, filename: candidate.filename };
  }

  if (oversizedBytes !== null) {
    const mb = Math.round(oversizedBytes / (1024 * 1024));
    return {
      ok: false,
      error: `This recording's audio source is ${mb} MB, over Whisper's 25 MB limit, and there's no smaller mic track to transcribe instead.`,
    };
  }
  return { ok: false, error: 'Could not download audio for transcription' };
}
