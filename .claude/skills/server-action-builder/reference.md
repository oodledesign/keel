# Server Action Reference

## enhanceAction API

```typescript
import { enhanceAction } from '@kit/next/actions';

export const myAction = enhanceAction(
  async function (data, user) {
    // data: validated input (typed from schema)
    // user: authenticated user object (if auth: true)

    return { success: true, data: result };
  },
  {
    auth: true,           // Require authentication (default: false)
    schema: ZodSchema,    // Zod schema for validation (optional)
  },
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auth` | `boolean` | `false` | Require authenticated user |
| `schema` | `ZodSchema` | - | Zod schema for input validation |

### Handler Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `z.infer<Schema>` | Validated input data |
| `user` | `User` | Authenticated user (if auth: true) |

## enhanceRouteHandler API

```typescript
import { enhanceRouteHandler } from '@kit/next/routes';
import { NextResponse } from 'next/server';

export const POST = enhanceRouteHandler(
  async function ({ body, user, request }) {
    // body: validated request body
    // user: authenticated user (if auth: true)
    // request: original NextRequest

    return NextResponse.json({ success: true });
  },
  {
    auth: true,
    schema: ZodSchema,
  },
);

export const GET = enhanceRouteHandler(
  async function ({ user, request }) {
    const url = new URL(request.url);
    const param = url.searchParams.get('param');

    return NextResponse.json({ data: result });
  },
  {
    auth: true,
  },
);
```

## Common Zod Patterns

```typescript
import { z } from 'zod';

// Basic schema
export const CreateItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  accountId: z.string().uuid('Invalid account ID'),
});

// With transforms
export const SearchSchema = z.object({
  query: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// With refinements
export const DateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date' }
);

// Enum values
export const StatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']),
});
```

## Revalidation

```typescript
import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';

// Revalidate specific path
revalidatePath('/home/[account]/items');

// Revalidate with dynamic segment
revalidatePath(`/home/${accountSlug}/items`);

// Revalidate by tag
revalidateTag('items');
```

## Redirect

```typescript
import { redirect } from 'next/navigation';

// Redirect after action
redirect('/success');

// Redirect with dynamic path
redirect(`/home/${accountSlug}/items/${itemId}`);
```

## Logging

```typescript
import { getLogger } from '@kit/shared/logger';

const logger = await getLogger();

// Context object for all logs
const ctx = {
  name: 'action-name',
  userId: user.id,
  accountId: data.accountId,
};

// Log levels
logger.info(ctx, 'Starting operation');
logger.warn({ ...ctx, warning: 'details' }, 'Warning message');
logger.error({ ...ctx, error }, 'Operation failed');
```

## Supabase Clients

```typescript
// Standard client (RLS enforced)
import { getSupabaseServerClient } from '@kit/supabase/server-client';
const client = getSupabaseServerClient();

// Admin client (bypasses RLS - use sparingly)
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
const adminClient = getSupabaseServerAdminClient();
```

## Error Handling

```typescript
import { isRedirectError } from 'next/dist/client/components/redirect-error';

try {
  await operation();
  redirect('/success');
} catch (error) {
  if (!isRedirectError(error)) {
    // Handle actual error
    logger.error({ error }, 'Operation failed');
    throw error;
  }
  throw error; // Re-throw redirect
}
```
