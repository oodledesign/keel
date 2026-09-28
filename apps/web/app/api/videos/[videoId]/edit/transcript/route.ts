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
