# @kit/keel-mcp

Keel MCP server package for the Turborepo monorepo. Exposes an authenticated MCP endpoint over **SSE (Server-Sent Events)** using `@modelcontextprotocol/sdk`, designed to run on Vercel serverless functions via the Next.js App Router.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/mcp` | Open an SSE stream and start an MCP session |
| `POST` | `/api/mcp/message?sessionId=…` | Send JSON-RPC messages for an active session |

Wire these in `apps/web`:

```ts
// app/api/mcp/route.ts
import { handleMcpGet } from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleMcpGet(request);
}
```

```ts
// app/api/mcp/message/route.ts
import { handleMcpPostMessage } from '@kit/keel-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleMcpPostMessage(request);
}
```

## Authentication

Every request must include:

```
Authorization: Bearer <api_key>
```

The bearer token is validated against the `api_keys` column on `public.profiles` using the Supabase **service role** client. Missing or invalid tokens receive `401 Unauthorized`.

After authentication, tools receive a request context with the resolved `userId`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes* | Fallback if `SUPABASE_URL` is unset |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for server-side queries |

\* At least one URL variable must be set.

## Adding a new tool

1. Create a registrar in `src/tools/`, e.g. `src/tools/ping.ts`:

```ts
import { z } from 'zod';

import type { KeelMcpToolRegistrar } from './types.js';

export const registerPingTool: KeelMcpToolRegistrar = (server, context) => {
  server.registerTool(
    'ping',
    {
      description: 'Health check — returns pong and the authenticated user id',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: `pong (user: ${context.userId})`,
        },
      ],
    }),
  );
};
```

2. Export it from `src/tools/index.ts`:

```ts
import { registerPingTool } from './ping.js';
import type { KeelMcpToolRegistrar } from './types.js';

export const keelMcpTools: KeelMcpToolRegistrar[] = [registerPingTool];
```

3. Use `context.supabase` inside tools to query Supabase on behalf of the authenticated user. Apply your own authorization checks (account membership, RLS-friendly filters, etc.) before returning data.

### Tool conventions

- **Register functions, not raw tool objects** — keeps auth context typed and testable.
- **Use Zod `inputSchema`** — matches MCP SDK expectations in v1.x.
- **Return MCP content blocks** — `{ content: [{ type: 'text', text: '...' }] }`.
- **Throw `Error` for user-facing failures** — the SDK surfaces these to clients.

## Serverless note (SSE sessions)

SSE transport keeps session state in memory (`session-store.ts`). On Vercel, follow-up `POST /api/mcp/message` requests must hit the **same function instance** that opened the SSE stream, or the session will not be found (`404`).

For production at scale, consider:

- Enabling Vercel Fluid / longer-lived compute for the MCP routes
- External session storage (e.g. Redis) keyed by `sessionId`
- Migrating to Streamable HTTP when your clients support it

## Development

```bash
pnpm install
pnpm --filter @kit/keel-mcp typecheck
```

Connect a client to `http://localhost:3000/api/mcp` with a valid profile API key in the `Authorization` header.

## Available tools

| Tool | Description |
|------|-------------|
| `list_tasks` | List the user's tasks (optional status, project, area, limit) |
| `create_task` | Create a task (`source = mcp`) |
| `update_task` | Update a task owned by the user |
| `list_projects` | List projects in the user's workspaces |
| `get_project` | Get a project and the user's tasks on it |
| `list_pipeline_deals` | List pipeline deals in the user's workspaces |
| `update_pipeline_deal` | Update deal stage or value |
| `list_clients` | List client orgs via `client_members` |
| `get_client` | Client org detail with open tasks and deals |
| `create_note` | Create a note linked to project and/or client org |
| `list_notes` | List notes owned by the user |

Tasks and notes are scoped directly by `user_id`. Projects and pipeline deals are scoped via `accounts_memberships`. Client tools use `client_members`.
