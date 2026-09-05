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
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

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
import { completeWorkspaceSetup } from '../../../_lib/server/workspace-setup.actions';

function slugPath(template: string, slug: string) {
  return template.replace('[account]', slug);
}

async function assertOwnerAccount(accountId: string, userId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select(
      'id, slug, name, primary_owner_user_id, business_onboarding_step, business_onboarding_completed_at',
    )
    .eq('id', accountId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Workspace not found.');
  }

  if (data.primary_owner_user_id !== userId) {
    throw new Error('Only the workspace owner can finish this setup.');
  }

  return data as {
    id: string;
    slug: string;
    name: string;
    primary_owner_user_id: string;
    business_onboarding_step: string | null;
    business_onboarding_completed_at: string | null;
  };
}

async function setOnboardingStep(
  accountId: string,
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

  const { error } = await admin
    .from('accounts')
    .update(payload)
    .eq('id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}

function billingRedirect(slug: string, productId: string, seats: number) {
  const billingPath = slugPath(pathsConfig.app.accountBilling, slug);
  const planId =
    productId === 'ozer-business-starter'
      ? 'business-starter-monthly'
      : 'business-monthly';
  const query = new URLSearchParams({
    setup: '1',
    product: productId,
    plan: planId,
    interval: 'month',
    seats: String(seats),
  });
  return `${billingPath}?${query.toString()}`;
}

export const saveBusinessCompanyAction = enhanceAction(
  async function (data, user) {
    const logger = await getLogger();
    logger.info({ name: 'business-onboarding-company', userId: user.id });

    const result = await completeWorkspaceSetup(
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
      throw new Error(result.error ?? 'Could not create your workspace.');
    }

    const admin = getSupabaseServerAdminClient();
    const accountId = result.accountId;
    const slug = result.accountSlug;

    const website = data.website?.trim() || null;
    if (website) {
      await admin.from('account_brand_settings').upsert(
        {
          account_id: accountId,
          website_url: website,
        },
        { onConflict: 'account_id' },
      );
      await maybeFetchWorkspaceLogo({ accountId, website });
    }

    if (data.firstName?.trim() || data.lastName?.trim()) {
      const client = getSupabaseServerClient();
      await client.from('user_settings').upsert(
        {
          user_id: user.id,
          first_name: data.firstName?.trim() || null,
          last_name: data.lastName?.trim() || null,
        },
        { onConflict: 'user_id' },
      );
    }

    revalidatePath(pathsConfig.app.workspaceSetup);
    revalidatePath(pathsConfig.app.businessOnboarding);

    return {
      accountId,
      accountSlug: slug,
      nextStep: 'client' as const,
    };
  },
  { auth: true, schema: SaveBusinessCompanySchema },
);

export const saveBusinessClientAction = enhanceAction(
  async function (data, user) {
    const account = await assertOwnerAccount(data.accountId, user.id);
    const clients = createClientsService(getSupabaseServerClient());

    const contactName = data.contactName?.trim() || '';
    const [firstName, ...rest] = contactName.split(/\s+/);
    const lastName = rest.join(' ') || undefined;

    const created = await clients.createClient({
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
    });

    const clientId = (created as { id?: string } | null)?.id;
    if (!clientId) {
      throw new Error('Could not create the client.');
    }

    if (data.enablePortal && data.contactEmail?.trim()) {
      try {
        await createClientPortalInvite({
          accountId: data.accountId,
          accountSlug: account.slug,
          clientId,
          email: data.contactEmail.trim(),
        });
      } catch (error) {
        console.info('[onboarding] portal invite skipped', error);
      }
    }

    await setOnboardingStep(data.accountId, 'task');
    revalidatePath(pathsConfig.app.businessOnboarding);

    return { clientId, nextStep: 'task' as const };
  },
  { auth: true, schema: SaveBusinessClientSchema },
);

export const saveBusinessTaskAction = enhanceAction(
  async function (data, user) {
    await assertOwnerAccount(data.accountId, user.id);
    await createRecorderTask({
      userId: user.id,
      accountId: data.accountId,
      title: data.title,
      notes: data.notes,
      clientId: data.clientId,
    });
    await setOnboardingStep(data.accountId, 'assistant');
    revalidatePath(pathsConfig.app.businessOnboarding);
    return { nextStep: 'assistant' as const };
  },
  { auth: true, schema: SaveBusinessTaskSchema },
);

export const skipBusinessTaskAction = enhanceAction(
  async function (data, user) {
    await assertOwnerAccount(data.accountId, user.id);
    await setOnboardingStep(data.accountId, 'assistant');
    revalidatePath(pathsConfig.app.businessOnboarding);
    return { nextStep: 'assistant' as const };
  },
  { auth: true, schema: SkipBusinessTaskSchema },
);

export const continueBusinessAssistantAction = enhanceAction(
  async function (data, user) {
    await assertOwnerAccount(data.accountId, user.id);
    await setOnboardingStep(data.accountId, 'plan');
    revalidatePath(pathsConfig.app.businessOnboarding);
    return { nextStep: 'plan' as const };
  },
  { auth: true, schema: ContinueBusinessAssistantSchema },
);

export const completeBusinessLiteAction = enhanceAction(
  async function (data, user) {
    const account = await assertOwnerAccount(data.accountId, user.id);
    await setOnboardingStep(data.accountId, 'done');
    revalidatePath(pathsConfig.app.businessOnboarding);
    revalidatePath(slugPath(pathsConfig.app.accountHome, account.slug));
    return {
      nextStep: 'done' as const,
      redirectTo: slugPath(pathsConfig.app.accountHome, account.slug),
    };
  },
  { auth: true, schema: CompleteBusinessLiteSchema },
);

export const startBusinessPaidPlanAction = enhanceAction(
  async function (data, user) {
    const account = await assertOwnerAccount(data.accountId, user.id);
    await setOnboardingStep(data.accountId, 'done');
    revalidatePath(pathsConfig.app.businessOnboarding);
    return {
      nextStep: 'done' as const,
      redirectTo: billingRedirect(account.slug, data.productId, data.seats),
    };
  },
  { auth: true, schema: StartBusinessPaidPlanSchema },
);

export async function loadBusinessOnboardingState(accountSlug?: string) {
  const user = await requireUserInServerComponent();
  const admin = getSupabaseServerAdminClient();

  let query = admin
    .from('accounts')
    .select(
      'id, slug, name, picture_url, primary_owner_user_id, business_onboarding_step, business_onboarding_completed_at, space_type',
    )
    .eq('is_personal_account', false)
    .eq('primary_owner_user_id', user.id);

  if (accountSlug) {
    query = query.eq('slug', accountSlug);
  }

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(5);

  const account = (data ?? []).find((row) => {
    const space = String(
      (row as { space_type?: string | null }).space_type ?? '',
    );
    return space === 'work' || space === '';
  }) as
    | {
        id: string;
        slug: string;
        name: string;
        picture_url: string | null;
        business_onboarding_step: string | null;
        business_onboarding_completed_at: string | null;
      }
    | undefined;

  if (!account) {
    return { user, account: null, clientId: null as string | null };
  }

  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('account_id', account.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    user,
    account,
    clientId: (client as { id?: string } | null)?.id ?? null,
  };
}

