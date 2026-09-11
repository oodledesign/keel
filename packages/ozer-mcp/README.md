# @kit/ozer-mcp

Ozer MCP server package — Streamable HTTP transport with Supabase OAuth 2.1 and RLS-scoped database access.

## Routes (apps/web)

Single endpoint at `/api/mcp` (GET/POST/DELETE/OPTIONS) using stateless Streamable HTTP.

Protected resource metadata:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728 path insertion)

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

export async function OPTIONS(request: Request) {
  return handleMcpRequest(request);
}
```

## Authentication

Every MCP request requires `Authorization: Bearer <supabase_oauth_access_token>`.
Tokens must be OAuth client tokens (`client_id` claim) issued by the Supabase
project. Session JWTs are rejected. Invalid or missing tokens receive `401` with:

```
WWW-Authenticate: Bearer resource_metadata="https://app.ozer.so/.well-known/oauth-protected-resource/api/mcp", scope="openid email profile"
```

Browser clients (ChatGPT web, Claude.ai) need CORS on metadata, 401 challenges,
and `/api/mcp` including OPTIONS. Database work runs through an anon-key client
carrying the user's token — no service role.

JSON-RPC notifications such as `notifications/initialized` correctly return
**202 Accepted** with an empty body. `initialize`, `tools/list`, and `tools/call`
return **200** JSON.

MCP tools do not delete projects, clients, contacts, tasks, or notes. `delete_project_phase` is the exception: it removes a phase and unphases its tasks (`phase_id` SET NULL), matching the web app.

## Workspace tools

| Tool              | Purpose                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `list_workspaces` | List team and personal accounts the OAuth user belongs to. Use `account_id` to scope other tools.   |
| `today_digest`    | Overdue + due today + recently updated outstanding root tasks, with client/project/workspace names. |

OAuth is user-level (not bound to one workspace). `list_tasks` defaults to outstanding work across all authorized workspaces.

## Task tools

| Tool             | Purpose                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_tasks`     | List current outstanding tasks across authorized workspaces (all clients/projects unless filtered). Defaults: `status=outstanding`, `sort=updated`, root tasks only, `limit=100`. Returns names plus `meta` (`total_count`, `truncated`).                           |
| `get_task`       | Fetch one task by id with notes, project/client/workspace/area names, and a subtasks summary.                                                                                                                                                                       |
| `create_task`    | Create a root task. Always include `duration_minutes` when known; the server estimates from title/notes if omitted (default 30). Optional `project_id`, `phase_id`, `client_id`. Use `search_*` / `list_project_phases` when the user names a client/project/phase. |
| `update_task`    | Patch a task: title, status, priority, due date, duration, notes, `project_id`, `phase_id`, `client_id`, `area_id`. Pass `phase_id=null` to unphase.                                                                                                                |
| `list_subtasks`  | List children of a parent task (`tasks.parent_task_id`).                                                                                                                                                                                                            |
| `create_subtask` | Create a child under a root parent. Inherits project/client/area. Always include `duration_minutes` when known; the server estimates if omitted.                                                                                                                    |
| `update_subtask` | Patch a subtask with the same fields as `update_task`.                                                                                                                                                                                                              |
| `extract_tasks`  | Parse a chat dump or bullets into proposed tasks (`mode=dry_run`, default) or create them (`mode=commit`). Includes `duration_minutes` (estimated when omitted). Links client/project on explicit ids or high-confidence name matches.                              |

Subtasks are the same `tasks` rows as the web app: `parent_task_id` points at the root parent. Nesting a subtask under another subtask is rejected.

`list_tasks` does not apply an implicit client or project filter. Pass `account_id` from `list_workspaces`, or `client_id` / `project_id`, only when the user asks to narrow the list. Use `offset` when `meta.truncated` is true.

## Client and project tools

CRM `clients` are workspace companies/people. Portal `client_orgs` are a separate membership model. Use CRM tools unless the user is talking about the client portal.

| Tool                   | Purpose                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `search_clients`       | Fuzzy CRM client search (id + name + email + workspace). Not portal `client_orgs`. Search before `create_client` / `create_contact`. |
| `list_clients`         | CRM clients in authorized workspaces (names + workspace). Optional `account_id` only when the user names a workspace.                |
| `get_client`           | One CRM client with contacts, outstanding tasks, and workspace name.                                                                 |
| `create_client`        | Create a CRM client (`account_id` required). Business needs `company_name`; individual needs `first_name`.                           |
| `update_client`        | Patch CRM client fields (name, email, website, address, `commercial_role`). Cannot delete.                                           |
| `list_client_orgs`     | Portal organizations via `client_members`. Prefer `list_clients` / `search_clients` for CRM.                                         |
| `get_client_org`       | One portal org with open tasks and pipeline deals.                                                                                   |
| `search_projects`      | Fuzzy project search (id + name + client + workspace + `is_phased`).                                                                 |
| `list_projects`        | Projects in authorized workspaces. Optional `account_id` / `client_id` / `status`. Includes `is_phased`.                             |
| `get_project`          | One project with outstanding tasks and names. Includes `is_phased` and task `phase_id`.                                              |
| `create_project`       | Create a delivery project (`name` + `account_id`, optional client/status/dates/`is_phased`, default `false`).                        |
| `update_project`       | Patch name, status, dates, description, client link, or `is_phased`. Flipping the flag does not invent or delete phases.             |
| `list_project_phases`  | Phases for a project, ordered by `sort_order`. Account-scoped like other tools.                                                      |
| `create_project_phase` | Create a phase (`project_id` + `name`). Optional description/status/dates/order. Does not flip `is_phased`.                          |
| `update_project_phase` | Patch phase name, description, status, dates, colour, milestone, or `sort_order`.                                                    |
| `delete_project_phase` | Delete a phase. Tasks become unphased (`phase_id` null), same as the web app. Does not delete the project.                           |

## Contacts

People in `contacts`, optionally linked to CRM clients via `client_contacts`. Industry is `contacts.industry`. Campaign category names are read-only when those tables exist — tools do not invent category columns.

| Tool              | Purpose                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `search_contacts` | Search by name, email, company, or industry. Optional `client_id` / `industry` only when the user names them.      |
| `list_contacts`   | List CRM contacts. Optional `account_id` / `client_id`. Prefer `search_contacts` when looking up a person.         |
| `get_contact`     | One contact with workspace name, linked CRM clients, industry, and campaign categories when present.               |
| `create_contact`  | Create a person (`account_id` + name). Optional `client_id` (use `search_clients` first), `industry`, email/phone. |
| `update_contact`  | Patch name, email, phone, company, industry, or link `client_id`. Cannot delete.                                   |

## Meetings

Stored as `meeting_transcripts` (Ozer recorder / pasted transcripts), not calendar events.

| Tool            | Purpose                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `list_meetings` | List transcripts with title, date, excerpt, and client/project/workspace names. Optional `client_id` / `project_id` / title `q`. |
| `get_meeting`   | One transcript with content (truncated if huge), optional AI summary, and client/project/workspace names.                        |

## Notes

| Tool          | Purpose                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `create_note` | Create a note; optional links to task, CRM client, project, or meeting transcript. |
| `update_note` | Patch title, content, or links.                                                    |
| `get_note`    | Fetch one note by id.                                                              |
| `list_notes`  | Recent notes; optional `account_id`, `task_id`, `client_id`, `project_id`, or `q`. |

## Pipeline

| Tool                   | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `list_pipeline_deals`  | Open deals by default (hides won/lost/completed). Optional `account_id` / `stage`.       |
| `get_pipeline_deal`    | One deal by id.                                                                          |
| `update_deal`          | Safe fields only: `stage`, `next_action_date`, `notes`. Does not change value or delete. |
| `update_pipeline_deal` | Alias of `update_deal`.                                                                  |

## Testing

```bash
npx @modelcontextprotocol/inspector
```

Point at `https://app.ozer.so/api/mcp` (or `http://localhost:3000/api/mcp` locally) and use Quick OAuth Flow against Supabase.

```bash
pnpm --filter @kit/ozer-mcp typecheck
pnpm --filter @kit/ozer-mcp test
```

### Verify in Claude / Inspector (Dan)

1. `list_workspaces` then `search_clients` for a known CRM name — confirm `workspace_name` is present, not only ids.
2. `create_client` for a throwaway business (`company_name`) and individual (`first_name`). Confirm they appear in the web CRM, not under portal orgs.
3. `search_contacts` / `create_contact` (optionally `client_id` from step 2). Confirm `industry` writes to `contacts.industry` when passed.
4. `list_meetings` then `get_meeting` on a real transcript — confirm client/project names and transcript content.
5. Confirm there is no delete tool for clients, contacts, or meetings.
