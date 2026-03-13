---
description: End-to-end feature implementation following Makerkit patterns across database, API, and UI layers
---

# Feature Builder

You are an expert at implementing complete features in Makerkit following established patterns across all layers.

You MUST use the specialized skills for each phase while building the feature.

- Database Schema: `postgres-supabase-expert`
- Server Layer: `server-action-builder`
- Forms: `forms-builder`

## Implementation Phases

### Phase 1: Database Schema

Use `postgres-supabase-expert` skill.

1. Create schema file in `apps/web/supabase/schemas/`
2. Enable RLS and create policies using helper functions
3. Generate migration: `pnpm --filter web supabase:db:diff -f feature_name`
4. Apply: `pnpm --filter web supabase migrations up`
5. Generate types: `pnpm supabase:web:typegen`

```sql
-- Example: apps/web/supabase/schemas/20-projects.sql
create table if not exists public.projects (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  name varchar(255) not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id)
);

alter table "public"."projects" enable row level security;
revoke all on public.projects from authenticated, service_role;
grant select, insert, update, delete on table public.projects to authenticated;

create policy "projects_read" on public.projects for select
  to authenticated using (
    account_id = (select auth.uid()) or
    public.has_role_on_account(account_id)
  );

create policy "projects_write" on public.projects for all
  to authenticated using (
    public.has_permission(auth.uid(), account_id, 'projects.manage'::app_permissions)
  );
```

### Phase 2: Server Layer

Use `server-action-builder` skill for detailed patterns.

**Rule: Services are decoupled from interfaces.** The service is pure logic that receives dependencies (database client, etc.) as arguments — it never imports framework-specific modules. The server action is a thin adapter that resolves dependencies and calls the service. This means the same service can be called from a server action, an MCP tool, a CLI command, or a unit test with zero changes.

Create in route's `_lib/server/` directory:

1. **Schema** (`_lib/schemas/feature.schema.ts`)
2. **Service** (`_lib/server/feature.service.ts`) — pure logic, dependencies injected, testable in isolation
3. **Actions** (`_lib/server/server-actions.ts`) — thin adapter, no business logic

### Phase 3: UI Components

Use `form-builder` skill for form patterns.

Create in route's `_components/` directory:

1. **List component** - Display items with loading states
2. **Form component** - Create/edit with validation
3. **Detail component** - Single item view

### Phase 4: Page Integration

Create page in appropriate route group:
- Personal: `apps/web/app/home/(user)/feature/`
- Team: `apps/web/app/home/[account]/feature/`

```typescript
// apps/web/app/home/[account]/projects/page.tsx
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { ProjectsList } from './_components/projects-list';

interface Props {
  params: Promise<{ account: string }>;
}

export default async function ProjectsPage({ params }: Props) {
  const { account } = await params;
  const client = getSupabaseServerClient();

  const { data: projects } = await client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader title="Projects" />
      <PageBody>
        <ProjectsList projects={projects ?? []} accountSlug={account} />
      </PageBody>
    </>
  );
}
```

### Phase 5: Navigation

Add routes to sidebar navigation in `apps/web/config/team-account-navigation.config.tsx` or `apps/web/config/personal-account-navigation.config.tsx`.

## File Structure

```
apps/web/app/home/[account]/projects/
├── page.tsx                    # List page
├── [projectId]/
│   └── page.tsx               # Detail page
├── _components/
│   ├── projects-list.tsx
│   ├── project-form.tsx
│   └── project-card.tsx
└── _lib/
    ├── schemas/
    │   └── project.schema.ts
    └── server/
        ├── project.service.ts
        └── server-actions.ts
```

## Verification Checklist

### Database Layer

- [ ] Schema file created in `apps/web/supabase/schemas/`
- [ ] RLS enabled on table
- [ ] Default permissions revoked
- [ ] Specific permissions granted to `authenticated`
- [ ] RLS policies use helper functions (`has_role_on_account`, `has_permission`)
- [ ] Indexes added for foreign keys and common queries
- [ ] Timestamps triggers added if applicable
- [ ] Migration generated and applied
- [ ] TypeScript types regenerated

### Server Layer

- [ ] Zod schema in `_lib/schemas/`
- [ ] Service class in `_lib/server/` with dependencies injected (not imported)
- [ ] Service contains all business logic — testable with mock dependencies
- [ ] Server actions are thin adapters — resolve dependencies, call service, handle revalidation
- [ ] Server actions use `enhanceAction`
- [ ] Actions have `auth: true` and `schema` options
- [ ] Logging added for operations
- [ ] `revalidatePath` called after mutations
- [ ] Error handling with `isRedirectError` check if applicable (i.e. when using redirect() in a server action)

### UI Layer

- [ ] Components in `_components/` directory
- [ ] Forms use `react-hook-form` with `zodResolver`
- [ ] Loading states with `useTransition`
- [ ] Error display with `Alert` component
- [ ] `data-test` attributes for E2E testing
- [ ] `Trans` component for all user-facing strings
- [ ] Toast notifications for success/error if applicable

### Page Layer

- [ ] Page in correct route group (user vs team)
- [ ] Async params handled with `await params`
- [ ] Server-side data fetching
- [ ] `PageHeader` and `PageBody` components used
- [ ] Proper error boundaries

### Navigation

- [ ] Path added to `config/paths.config.ts`
- [ ] Menu item added to navigation config
- [ ] Translation key added to `public/locales/en/common.json`

### Testing

- [ ] Page Object created for E2E tests
- [ ] Basic CRUD operations tested
- [ ] Error states tested
- [ ] `data-test` selectors used in tests

### Final Verification

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint:fix

# Format
pnpm format:fix

# Test (if tests exist)
pnpm --filter web-e2e exec playwright test feature-name --workers=1
```

When you are done, run the code quality reviewer agent to verify the code quality.
