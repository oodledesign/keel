# Super Admin

## Critical Security Rules

- **ALWAYS** use `AdminGuard` to protect pages
- **ALWAYS** validate admin status before operations
- **NEVER** bypass authentication or authorization
- **ALWAYS** audit admin operations with logging
- **ALWAYS** use `adminAction` to wrap admin actions @packages/features/admin/src/lib/server/utils/admin-action.ts

## Page Structure

```typescript
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

async function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <PageBody>{/* Content */}</PageBody>
    </>
  );
}

export default AdminGuard(AdminPage);
```

## Admin Client Usage

```typescript
import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

async function adminOperation() {
  // CRITICAL: Validate first - admin client bypasses RLS
  if (!(await isSuperAdmin(currentUser))) {
    throw new Error('Unauthorized');
  }

  const adminClient = getSupabaseServerAdminClient();
  // Safe to proceed
}
```

## Audit Logging

```typescript
const logger = await getLogger();
logger.info({
  name: 'admin-audit',
  action: 'delete-user',
  adminId: currentUser.id,
  targetId: userId,
}, 'Admin action performed');
```
