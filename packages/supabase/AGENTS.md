# Database & Authentication

## Skills

For database work:
- `/postgres-expert` - Schemas, RLS, migrations

## Client Usage

### Server Components (Preferred)

```typescript
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const client = getSupabaseServerClient();
const { data } = await client.from('table').select('*');
// RLS automatically enforced
```

### Client Components

```typescript
'use client';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

const supabase = useSupabase();
```

### Admin Client (Use Sparingly)

```typescript
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

// CRITICAL: Bypasses RLS - validate manually!
const adminClient = getSupabaseServerAdminClient();
```

## Existing Helper Functions

```sql
public.has_role_on_account(account_id, role?)
public.has_permission(user_id, account_id, permission)
public.is_account_owner(account_id)
public.has_active_subscription(account_id)
public.is_team_member(account_id, user_id)
public.is_super_admin()
```

## Type Generation

```typescript
import { Tables } from '@kit/supabase/database';

type Account = Tables<'accounts'>;
```

Never modify `database.types.ts` - regenerate with `pnpm supabase:web:typegen`.

## Authentication

```typescript
import { requireUser } from '@kit/supabase/require-user';
import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';

const user = await requireUser(client);
const requiresMfa = await checkRequiresMultiFactorAuthentication(client);
```

## Security Guidelines

- Standard client: Trust RLS
- Admin client: Validate everything manually
- Always add indexes for foreign keys
- Storage paths must include account_id
