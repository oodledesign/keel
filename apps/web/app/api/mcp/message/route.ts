import { handleMcpPostMessage } from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleMcpPostMessage(request);
}
