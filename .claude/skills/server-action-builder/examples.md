# Server Action Examples

Real examples from the Makerkit codebase.

## Team Billing Action

Location: `apps/web/app/home/[account]/billing/_lib/server/server-actions.ts`

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { revalidatePath } from 'next/cache';

import { UpdateBillingSchema } from '../schemas/billing.schema';
import { createBillingService } from './billing.service';

export const updateBillingAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'update-billing', userId: user.id, accountId: data.accountId };

    logger.info(ctx, 'Updating billing settings');

    const service = createBillingService();
    await service.updateBilling(data);

    logger.info(ctx, 'Billing settings updated');

    revalidatePath(`/home/${data.accountSlug}/billing`);

    return { success: true };
  },
  {
    auth: true,
    schema: UpdateBillingSchema,
  },
);
```

## Personal Settings Action

Location: `apps/web/app/home/(user)/settings/_lib/server/server-actions.ts`

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { revalidatePath } from 'next/cache';

import { UpdateProfileSchema } from '../schemas/profile.schema';

export const updateProfileAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'update-profile', userId: user.id };

    logger.info(ctx, 'Updating user profile');

    const client = getSupabaseServerClient();

    const { error } = await client
      .from('accounts')
      .update({ name: data.name })
      .eq('id', user.id);

    if (error) {
      logger.error({ ...ctx, error }, 'Failed to update profile');
      throw error;
    }

    logger.info(ctx, 'Profile updated successfully');

    revalidatePath('/home/settings');

    return { success: true };
  },
  {
    auth: true,
    schema: UpdateProfileSchema,
  },
);
```

## Action with Redirect

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { redirect } from 'next/navigation';

import { CreateProjectSchema } from '../schemas/project.schema';
import { createProjectService } from './project.service';

export const createProjectAction = enhanceAction(
  async function (data, user) {
    const service = createProjectService();
    const project = await service.create(data);

    // Redirect after creation
    redirect(`/home/${data.accountSlug}/projects/${project.id}`);
  },
  {
    auth: true,
    schema: CreateProjectSchema,
  },
);
```

## Delete Action with Confirmation

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { revalidatePath } from 'next/cache';

import { DeleteItemSchema } from '../schemas/item.schema';

export const deleteItemAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'delete-item', userId: user.id, itemId: data.itemId };

    logger.info(ctx, 'Deleting item');

    const client = getSupabaseServerClient();

    const { error } = await client
      .from('items')
      .delete()
      .eq('id', data.itemId)
      .eq('account_id', data.accountId); // RLS will also validate

    if (error) {
      logger.error({ ...ctx, error }, 'Failed to delete item');
      throw error;
    }

    logger.info(ctx, 'Item deleted successfully');

    revalidatePath(`/home/${data.accountSlug}/items`);

    return { success: true };
  },
  {
    auth: true,
    schema: DeleteItemSchema,
  },
);
```

## Error Handling with isRedirectError

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';

export const submitFormAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'submit-form', userId: user.id };

    try {
      logger.info(ctx, 'Submitting form');

      // Process form
      await processForm(data);

      logger.info(ctx, 'Form submitted, redirecting');

      redirect('/success');
    } catch (error) {
      // Don't treat redirects as errors
      if (!isRedirectError(error)) {
        logger.error({ ...ctx, error }, 'Form submission failed');
        throw error;
      }
      throw error; // Re-throw redirect
    }
  },
  {
    auth: true,
    schema: FormSchema,
  },
);
```
