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

## Task tools

| Tool             | Purpose                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `list_tasks`     | List tasks (optional status / project / area / parent_task_id). Includes `duration_minutes` and `parent_task_id`. |
| `get_task`       | Fetch one task by id with notes, project/area names, and a subtasks summary.                                      |
| `create_task`    | Create a root task. Optional `duration_minutes` is estimated effort. Use `create_subtask` for children.           |
| `update_task`    | Patch a task (root or subtask): title, status, priority, due date, duration, notes, `project_id`, `area_id`.      |
| `list_subtasks`  | List children of a parent task (`tasks.parent_task_id`).                                                          |
| `create_subtask` | Create a child under a root parent. Inherits project/area. Optional duration, status, priority, due date, notes.  |
| `update_subtask` | Patch a subtask with the same fields as `update_task`.                                                            |

Subtasks are the same `tasks` rows as the web app: `parent_task_id` points at the root parent. Nesting a subtask under another subtask is rejected.

## Testing

```bash
npx @modelcontextprotocol/inspector
```

Point at `https://app.ozer.so/api/mcp` (or `http://localhost:3000/api/mcp` locally) and use Quick OAuth Flow against Supabase.

```bash
pnpm --filter @kit/ozer-mcp typecheck
```
