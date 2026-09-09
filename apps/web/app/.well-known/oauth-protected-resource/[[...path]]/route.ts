import {
  getOAuthProtectedResourceMetadata,
  isMcpProtectedResourceMetadataPath,
  mcpCorsPreflightResponse,
  withMcpCors,
} from '@kit/ozer-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export function OPTIONS() {
  return mcpCorsPreflightResponse();
}

export async function GET(_request: Request, context: RouteContext) {
  const { path = [] } = await context.params;

  if (!isMcpProtectedResourceMetadataPath(path)) {
    return withMcpCors(new Response('Not Found', { status: 404 }));
  }

  return withMcpCors(
    Response.json(getOAuthProtectedResourceMetadata(), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    }),
  );
}
