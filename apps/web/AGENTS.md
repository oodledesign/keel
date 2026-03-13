# Web Application

## Route Organization

```
app/
├── (marketing)/          # Public pages
├── (auth)/               # Authentication
├── home/                 # Authenticated routes
│   ├── (user)/           # Personal account
│   └── [account]/        # Team account (slug, not ID)
├── admin/                # Super admin
└── api/                  # API routes
```

## Component Organization

- Route-specific: `_components/`
- Route utilities: `_lib/` (client), `_lib/server/` (server)

## Skills

For specialized implementation:
- `/feature-builder` - End-to-end feature implementation
- `/service-builder` - Server side services
- `/server-action-builder` - Server actions
- `/forms-builder` - Forms with validation
- `/navigation-config` - Adding routes and menu items

## Next.js 16 Params Pattern

```typescript
// CORRECT - await params directly
async function Page({ params }: Props) {
  const { account } = await params;
}
```

## Data Fetching

- **Server Components** (default): `getSupabaseServerClient()` - RLS enforced
- **Client Components**: `useSupabase()` hook with React Query
- **Admin Client**: Bypasses RLS - requires manual auth validation

## Workspace Contexts

```typescript
// Personal: app/home/(user)
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

// Team: app/home/[account]
import { useTeamAccountWorkspace } from '@kit/team-accounts/hooks/use-team-account-workspace';
```

## Key Config Files

| Purpose | Location |
|---------|----------|
| Feature flags | `config/feature-flags.config.ts` |
| Paths | `config/paths.config.ts` |
| Personal nav | `config/personal-account-navigation.config.tsx` |
| Team nav | `config/team-account-navigation.config.tsx` |
| i18n | `lib/i18n/i18n.settings.ts` |

## Internationalization

Always use `Trans` component:

```tsx
import { Trans } from '@kit/ui/trans';
<Trans i18nKey="namespace:key" values={{ name }} />
```

## Security

- Authentication enforced by middleware
- Authorization handled by RLS
- Never pass sensitive data to Client Components
- Never expose server env vars to client
