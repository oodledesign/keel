# @kit/ozer-mcp

Ozer MCP server package — Streamable HTTP transport with Supabase OAuth 2.1 and RLS-scoped database access.

## Routes (apps/web)

Single endpoint at `/api/mcp` (GET/POST/DELETE) using stateless Streamable HTTP.

Protected resource metadata: `/.well-known/oauth-protected-resource`

OAuth consent UI: `/oauth/consent` with decision POST at `/api/oauth/decision`

## App route wiring

```typescript
// apps/web/app/api/mcp/route.ts
import { handleMcpRequest } from '@kit/ozer-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}
```

## Authentication

Every MCP request requires `Authorization: Bearer <supabase_oauth_access_token>`. Invalid or missing tokens receive `401` with:

```
WWW-Authenticate: Bearer resource_metadata="https://app.ozer.so/.well-known/oauth-protected-resource"
```

Database work runs through an anon-key client carrying the user's token — no service role.

## Testing

```bash
npx @modelcontextprotocol/inspector
```

Point at `https://app.ozer.so/api/mcp` (or `http://localhost:3000/api/mcp` locally) and use Quick OAuth Flow against Supabase.

```bash
pnpm --filter @kit/ozer-mcp typecheck
```
