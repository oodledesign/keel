import { NextResponse } from 'next/server';

import { z } from 'zod';

import type { VideoTranscriptWord } from '~/lib/videos/edit-timeline';
import { createSignedMasterUrl } from '~/lib/videos/server/video-edit.service';
import { requireVideoById } from '~/lib/videos/server/videos-access';

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

async function transcribeMaster(
  client: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          a: string,
          b: string,
        ) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  },
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
    .select('storage_path')
    .eq('video_id', videoId)
    .maybeSingle();

  const row = master as { storage_path?: string } | null;
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
    const signedUrl = await createSignedMasterUrl(row.storage_path, 60 * 30);
    const mediaRes = await fetch(signedUrl);
    if (!mediaRes.ok) {
      return { ok: false, error: 'Could not download master for STT' };
    }
    const blob = await mediaRes.blob();
    const form = new FormData();
    form.append('file', blob, 'master.mp4');
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
