import {
  getMcpResourceUrl,
  SUPABASE_AUTH_SERVER,
} from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    resource: getMcpResourceUrl(),
    authorization_servers: [SUPABASE_AUTH_SERVER],
  });
}
