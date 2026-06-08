import { handleMcpGet } from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleMcpGet(request);
}
