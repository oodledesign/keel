---
name: server-action-builder
description: Create Next.js Server Actions with enhanceAction, Zod validation, and service patterns. Use when implementing mutations, form submissions, or API operations that need authentication and validation. Invoke with /server-action-builder.
---

# Server Action Builder

You are an expert at creating type-safe server actions for Makerkit following established patterns.

## Workflow

When asked to create a server action, follow these steps:

### Step 1: Create Zod Schema

Create validation schema in `_lib/schemas/`:

```typescript
// _lib/schemas/feature.schema.ts
import { z } from 'zod';

export const CreateFeatureSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  accountId: z.string().uuid('Invalid account ID'),
});

export type CreateFeatureInput = z.infer<typeof CreateFeatureSchema>;
```

### Step 2: Create Service Layer

**North star: services are decoupled from their interface.** The service is pure logic — it receives a database client as a dependency, never imports one. This means the same service works whether called from a server action, an MCP tool, a CLI command, or a plain unit test.

Create service in `_lib/server/`:

```typescript
// _lib/server/feature.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateFeatureInput } from '../schemas/feature.schema';

export function createFeatureService(client: SupabaseClient) {
  return new FeatureService(client);
}

class FeatureService {
  constructor(private readonly client: SupabaseClient) {}

  async create(data: CreateFeatureInput) {
    const { data: result, error } = await this.client
      .from('features')
      .insert({
        name: data.name,
        account_id: data.accountId,
      })
      .select()
      .single();

    if (error) throw error;

    return result;
  }
}
```

The service never calls `getSupabaseServerClient()` — the caller provides the client. This keeps the service testable (pass a mock client) and reusable (any interface can supply its own client).

### Step 3: Create Server Action (Thin Adapter)

The action is a **thin adapter** — it resolves dependencies (client, logger) and delegates to the service. No business logic lives here.

Create action in `_lib/server/server-actions.ts`:

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';

import { CreateFeatureSchema } from '../schemas/feature.schema';
import { createFeatureService } from './feature.service';

export const createFeatureAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'create-feature', userId: user.id };

    logger.info(ctx, 'Creating feature');

    const client = getSupabaseServerClient();
    const service = createFeatureService(client);
    const result = await service.create(data);

    logger.info({ ...ctx, featureId: result.id }, 'Feature created');

    revalidatePath('/home/[account]/features');

    return { success: true, data: result };
  },
  {
    auth: true,
    schema: CreateFeatureSchema,
  },
);
```

## Key Patterns

1. **Services are pure, interfaces are thin adapters.** The service contains all business logic. The server action (or MCP tool, or CLI command) is glue code that resolves dependencies and calls the service. If an MCP tool and a server action do the same thing, they call the same service function.
2. **Inject dependencies, don't import them in services.** Services receive their database client, logger, or any I/O capability as constructor arguments — never by importing framework-specific modules. This keeps them testable with stubs and reusable across interfaces.
3. **Schema in separate file** - Reusable between client and server
4. **Logging** - Always log before and after operations
5. **Revalidation** - Use `revalidatePath` after mutations
6. **Trust RLS** - Don't add manual auth checks (RLS handles it)
7. **Testable in isolation** - Because services accept their dependencies, you can test them with a mock client and no running infrastructure

## File Structure

```
feature/
├── _lib/
│   ├── schemas/
│   │   └── feature.schema.ts
│   └── server/
│       ├── feature.service.ts
│       └── server-actions.ts
└── _components/
    └── feature-form.tsx
```

## Reference Files

See examples in:
- `[Examples](examples.md)`
- `[Reference](reference.md)`
