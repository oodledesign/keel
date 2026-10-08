import { NextResponse } from 'next/server';

import { uploadChatImage } from '~/lib/messages/upload-chat-image';
import { NativeHttpError } from '~/lib/native/http';
import { mapMessagesError } from '~/lib/native/messages';
import { isUuid } from '~/lib/native/workspace-shared';
import { withRecorderAuth } from '~/lib/recorder/recorder-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return withRecorderAuth(
    request,
    'recorder/messages/upload-image',
    async (auth) => {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw new NativeHttpError(400, 'Invalid form data');
      }

      const threadId = String(
        formData.get('threadId') ?? formData.get('thread_id') ?? '',
      ).trim();
      const file = formData.get('file');
      if (!isUuid(threadId) || !(file instanceof File)) {
        throw new NativeHttpError(400, 'threadId and file are required.');
      }

      try {
        // Participant check happens inside; the thread fixes the workspace.
        const { imageUrl } = await uploadChatImage({
          userId: auth.user_id,
          threadId,
          file,
        });
        return NextResponse.json({ imageUrl, image_url: imageUrl });
      } catch (error) {
        mapMessagesError(error);
      }
    },
  );
}
