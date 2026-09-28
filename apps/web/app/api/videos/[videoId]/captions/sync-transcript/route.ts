import { createBunnyStreamClient } from '@kit/bunny';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import {
  type BunnyCaptionSyncFailure,
  bunnyCaptionKeepRanges,
  syncTranscriptCaptionsToBunny,
} from '~/lib/videos/server/sync-bunny-captions';
import { requireVideoById } from '~/lib/videos/server/videos-access';
import { resolveAccountBunnyApiKey } from '~/lib/videos/server/videos-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ videoId: string }>;
};

const FAILURE_MESSAGES: Record<BunnyCaptionSyncFailure, string> = {
  no_transcript: 'Transcribe this video in the editor first.',
  estimated_timings:
    'This transcript came from the desktop app and has no word timings. Re-run transcription in the editor to generate captions.',
  no_cues: 'The transcript has no words in the published video.',
  bake_pending:
    'The edited video is still being prepared for embeds. Try again in a few minutes.',
};

/** Push captions built from the word-timed transcript to the Bunny video. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { videoId } = await context.params;
    const access = await requireVideoById(videoId);

    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const video = access.video!;
    const timing = bunnyCaptionKeepRanges(video);
    if (!timing.ok) {
      return jsonErr('CONFLICT', FAILURE_MESSAGES.bake_pending, 409);
    }

    const accountId = video.account_id as string;
    const libraryId = String(video.bunny_library_id);
    const bunnyVideoId = String(video.bunny_video_id);

    const result = await syncTranscriptCaptionsToBunny({
      client: access.client,
      videoId,
      accountId,
      bunnyLibraryId: libraryId,
      bunnyVideoId,
      keepRanges: timing.keepRanges,
    });

    if (!result.ok) {
      return jsonErr('VALIDATION', FAILURE_MESSAGES[result.reason], 422);
    }

    const apiKey = await resolveAccountBunnyApiKey(access.client, accountId);
    const captions = await createBunnyStreamClient(apiKey).listCaptions(
      libraryId,
      bunnyVideoId,
    );

    return jsonOk({ captions, srclang: result.srclang });
  } catch (error) {
    console.error('[videos] captions sync-transcript POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Caption sync failed',
      500,
    );
  }
}
