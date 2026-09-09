import { handleRecorderMessageThreadsGet } from '~/lib/recorder/list-recorder-message-threads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export function GET(request: Request) {
  return handleRecorderMessageThreadsGet(request, 'recorder/messages');
}
