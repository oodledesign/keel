import {
  getMcpResourceUrl,
  SUPABASE_OAUTH_AS_DISCOVERY_URL,
} from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      resource: getMcpResourceUrl(),
      authorization_servers: [SUPABASE_OAUTH_AS_DISCOVERY_URL],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
