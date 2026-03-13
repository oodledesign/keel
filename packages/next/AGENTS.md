# Next.js Utilities

## Quick Reference

| Function | Import | Purpose |
|----------|--------|---------|
| `enhanceAction` | `@kit/next/actions` | Server actions with auth + validation |
| `enhanceRouteHandler` | `@kit/next/routes` | API routes with auth + validation |

## Guidelines

- Server Actions for mutations only, not data-fetching
- Keep actions light - move business logic to services
- Authorization via RLS, not application code
- Use `'use server'` at top of file
- Always validate with Zod schema

## Skills

For detailed implementation patterns:
- `/server-action-builder` - Complete server action workflow

## Server Action Pattern

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';

export const myAction = enhanceAction(
  async function (data, user) {
    // data: validated, user: authenticated
    return { success: true };
  },
  {
    auth: true,
    schema: MySchema,
  },
);
```

## Route Handler Pattern

```typescript
import { enhanceRouteHandler } from '@kit/next/routes';

export const POST = enhanceRouteHandler(
  async function ({ body, user, request }) {
    return NextResponse.json({ success: true });
  },
  { auth: true, schema: MySchema },
);
```

## Revalidation

- Use `revalidatePath` after mutations
- Never use `router.refresh()` or `router.push()` after Server Actions
