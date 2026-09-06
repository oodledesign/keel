'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { maybeFetchWorkspaceLogo } from '~/lib/brand/fetch-workspace-logo';
import { createClientPortalInvite } from '~/lib/clients/client-portal-invites.service';
import { createRecorderTask } from '~/lib/recorder/create-task';
import { fromAccountsUntyped } from '~/lib/supabase/accounts-table';
import { toPublicOnboardingError } from '~/lib/workspace/onboarding-public-error';

import { completeWorkspaceSetupForUser } from '../../../_lib/server/workspace-setup.service';
import { businessPaidPlanBillingPath } from '../business-billing-redirect';
import { type BusinessOnboardingStep } from '../business-onboarding-steps';
import {
  CompleteBusinessLiteSchema,
  ContinueBusinessAssistantSchema,
  SaveBusinessClientSchema,
  SaveBusinessCompanySchema,
  SaveBusinessTaskSchema,
  SkipBusinessTaskSchema,
  StartBusinessPaidPlanSchema,
} from '../schemas/business-onboarding.schema';
import { findInProgressBusinessWorkspace } from './business-onboarding.loader';

function slugPath(template: string, slug: string) {
  return template.replace('[account]', slug);
}

async function assertOwnerAccount(accountId: string, userId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await fromAccountsUntyped(admin)
    .select(
      'id, slug, name, primary_owner_user_id, business_onboarding_step, business_onboarding_completed_at',
    )
    .eq('id', accountId)
    .maybeSingle();

  if (error || !data) {
    return { error: 'Workspace not found.' as const };
  }

  if (data.primary_owner_user_id !== userId) {
    return {
      error: 'Only the workspace owner can finish this setup.' as const,
    };
  }

  return {
    account: data as {
      id: string;
      slug: string;
      name: string;
      primary_owner_user_id: string;
      business_onboarding_step: string | null;
      business_onboarding_completed_at: string | null;
    },
  };
}

async function setOnboardingStep(
  accountId: string,
  userId: string,
  step: BusinessOnboardingStep | 'done',
) {
  const admin = getSupabaseServerAdminClient();
  const payload =
    step === 'done'
      ? {
          business_onboarding_step: 'done',
          business_onboarding_completed_at: new Date().toISOString(),
        }
      : { business_onboarding_step: step };

  const { error } = await fromAccountsUntyped(admin)
    .update(payload)
    .eq('id', accountId)
    .eq('primary_owner_user_id', userId);

  if (error) {
    return { error: toPublicOnboardingError(error.message) };
  }

  return {};
}

async function pinDefaultWorkspace(userId: string, slug: string) {
  const client = getSupabaseServerClient();
  await client.from('user_settings').upsert(
    {
      user_id: userId,
      default_landing_type: 'workspace',
      default_workspace_slug: slug,
    },
    { onConflict: 'user_id' },
  );
}

export const saveBusinessCompanyAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    const ctx = { name: 'business-onboarding-company', userId: user.id };

    try {
      logger.info(ctx, 'Saving company step');

      const existing = await findInProgressBusinessWorkspace(user.id);
      let accountId = existing?.id ?? null;
      let slug = existing?.slug ?? null;

      if (!accountId || !slug) {
        const result = await completeWorkspaceSetupForUser(
          user.id,
          [
            {
              profile: 'work_design',
              name: data.name,
              businessMode: 'lite',
            },
          ],
          { skipTeamWorkspaces: false },
        );

        if (result.error || !result.accountId || !result.accountSlug) {
          logger.error(
            { ...ctx, error: result.error },
            'Workspace create failed',
          );
          return {
            error: toPublicOnboardingError(
              result.error ?? 'Could not create your workspace.',
            ),
          };
        }

        accountId = result.accountId;
        slug = result.accountSlug;
      } else {
        const admin = getSupabaseServerAdminClient();
        const { error: updateError } = await fromAccountsUntyped(admin)
          .update({ name: data.name })
          .eq('id', accountId)
          .eq('primary_owner_user_id', user.id);

        if (updateError) {
          logger.error(
            { ...ctx, error: updateError.message },
            'Name update failed',
          );
          return { error: toPublicOnboardingError(updateError.message) };
        }
      }

      const website = data.website?.trim() || null;
      let pictureUrl: string | null = null;
      if (website) {
        const admin = getSupabaseServerAdminClient();
        await admin.from('account_brand_settings').upsert(
          {
            account_id: accountId,
            website_url: website,
          },
          { onConflict: 'account_id' },
        );
        pictureUrl = await maybeFetchWorkspaceLogo({ accountId, website });
      }

      const admin = getSupabaseServerAdminClient();
      await admin
        .from('businesses')
        .update({ name: data.name })
        .eq('account_id', accountId);

      if (!slug) {
        return { error: 'Could not create your workspace.' };
      }

      const client = getSupabaseServerClient();
      await client.from('user_settings').upsert(
        {
          user_id: user.id,
          default_landing_type: 'workspace',
          default_workspace_slug: slug,
          ...(data.firstName?.trim() || data.lastName?.trim()
            ? {
                first_name: data.firstName?.trim() || null,
                last_name: data.lastName?.trim() || null,
              }
            : {}),
        },
        { onConflict: 'user_id' },
      );

      revalidatePath(pathsConfig.app.workspaceSetup);
      revalidatePath(pathsConfig.app.home);

      logger.info({ ...ctx, accountId, slug }, 'Company step saved');

      return {
        accountId,
        accountSlug: slug,
        pictureUrl,
        nextStep: 'client' as const,
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Company step crashed');
      return { error: toPublicOnboardingError(error) };
    }
  },
  { auth: true, schema: SaveBusinessCompanySchema },
);

export const saveBusinessClientAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error || !owner.account) {
        return { error: owner.error ?? 'Workspace not found.' };
      }

      const clients = createClientsService(getSupabaseServerClient());

      const contactName = data.contactName?.trim() || '';
      const [firstName, ...rest] = contactName.split(/\s+/);
      const lastName = rest.join(' ') || undefined;

      const created = (await clients.createClient({
        accountId: data.accountId,
        client_type: 'business',
        company_name: data.companyName,
        website: data.website || undefined,
        email: data.contactEmail || undefined,
        contact:
          firstName || data.contactEmail
            ? {
                firstName: firstName || data.companyName,
                lastName,
                email: data.contactEmail || undefined,
                isPrimary: true,
              }
            : undefined,
      })) as {
        id?: string;
        company_name?: string | null;
        website?: string | null;
        picture_url?: string | null;
        email?: string | null;
      } | null;

      const clientId = created?.id;
      if (!clientId) {
        return { error: 'Could not create the client.' };
      }

      if (data.enablePortal && data.contactEmail?.trim()) {
        try {
          await createClientPortalInvite({
            accountId: data.accountId,
            accountSlug: owner.account.slug,
            clientId,
            email: data.contactEmail.trim(),
          });
        } catch (error) {
          const logger = await getLogger();
          logger.info(
            { name: 'business-onboarding-portal-invite', error },
            'Portal invite skipped',
          );
        }
      }

      const step = await setOnboardingStep(data.accountId, user.id, 'task');
      if (step.error) {
        return { error: step.error };
      }

      return {
        clientId,
        client: {
          id: clientId,
          name: created.company_name ?? data.companyName,
          website: created.website ?? data.website ?? null,
          pictureUrl: created.picture_url ?? null,
          email: created.email ?? data.contactEmail ?? null,
        },
        nextStep: 'task' as const,
      };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not add the client.'),
      };
    }
  },
  { auth: true, schema: SaveBusinessClientSchema },
);

export const saveBusinessTaskAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error) {
        return { error: owner.error };
      }

      await createRecorderTask({
        userId: user.id,
        accountId: data.accountId,
        title: data.title,
        notes: data.notes,
        clientId: data.clientId,
      });
      const step = await setOnboardingStep(
        data.accountId,
        user.id,
        'assistant',
      );
      if (step.error) {
        return { error: step.error };
      }
      return { nextStep: 'assistant' as const, taskTitle: data.title };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not add the task.'),
      };
    }
  },
  { auth: true, schema: SaveBusinessTaskSchema },
);

export const skipBusinessTaskAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error) {
        return { error: owner.error };
      }
      const step = await setOnboardingStep(
        data.accountId,
        user.id,
        'assistant',
      );
      if (step.error) {
        return { error: step.error };
      }
      return { nextStep: 'assistant' as const };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not skip this step.'),
      };
    }
  },
  { auth: true, schema: SkipBusinessTaskSchema },
);

export const continueBusinessAssistantAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error) {
        return { error: owner.error };
      }
      const step = await setOnboardingStep(data.accountId, user.id, 'plan');
      if (step.error) {
        return { error: step.error };
      }
      return { nextStep: 'plan' as const };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not continue setup.'),
      };
    }
  },
  { auth: true, schema: ContinueBusinessAssistantSchema },
);

export const completeBusinessLiteAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error || !owner.account) {
        return { error: owner.error ?? 'Workspace not found.' };
      }
      const step = await setOnboardingStep(data.accountId, user.id, 'done');
      if (step.error) {
        return { error: step.error };
      }
      await pinDefaultWorkspace(user.id, owner.account.slug);
      revalidatePath(slugPath(pathsConfig.app.accountHome, owner.account.slug));
      return {
        nextStep: 'done' as const,
        redirectTo: slugPath(pathsConfig.app.accountHome, owner.account.slug),
      };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not finish setup.'),
      };
    }
  },
  { auth: true, schema: CompleteBusinessLiteSchema },
);

export const startBusinessPaidPlanAction = enhanceAction(
  async function (data, user) {
    try {
      const owner = await assertOwnerAccount(data.accountId, user.id);
      if (owner.error || !owner.account) {
        return { error: owner.error ?? 'Workspace not found.' };
      }
      const step = await setOnboardingStep(data.accountId, user.id, 'done');
      if (step.error) {
        return { error: step.error };
      }
      await pinDefaultWorkspace(user.id, owner.account.slug);
      return {
        nextStep: 'done' as const,
        redirectTo: businessPaidPlanBillingPath(
          owner.account.slug,
          data.productId,
          data.seats,
        ),
      };
    } catch (error) {
      return {
        error: toPublicOnboardingError(error, 'Could not start checkout.'),
      };
    }
  },
  { auth: true, schema: StartBusinessPaidPlanSchema },
);
