'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  ensureClientOrgSupportToken,
  rotateClientOrgSupportToken,
} from '~/lib/support/public-support.service';
import { resolveClientOrgAccountId } from '~/lib/support/resolve-client-org-account';

import { createWebsitesService } from '../../../websites/_lib/server/websites.service';

async function assertAccountManager(accountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (membership as { account_role?: string } | null)?.account_role;
  if (!role || role === 'contractor' || role === 'client') {
    throw new Error('Permission denied');
  }

  return user;
}

/**
 * Verify the org exists and belongs to this workspace.
 * Uses admin for the org lookup — `client_orgs` RLS often blocks the user client.
 */
async function assertCanManageClientOrg(
  accountId: string,
  clientOrgId: string,
) {
  await assertAccountManager(accountId);

  const admin = getSupabaseServerAdminClient();
  const { data: org } = await admin
    .from('client_orgs')
    .select('id, business_id, slug')
    .eq('id', clientOrgId)
    .maybeSingle();

  if (!org) throw new Error('Client not found');

  const orgAccountId = await resolveClientOrgAccountId(
    admin,
    org as { business_id?: string | null },
  );
  const businessId = (org as { business_id?: string | null }).business_id;
  const belongsToWorkspace =
    orgAccountId === accountId || businessId === accountId;

  if (!belongsToWorkspace) {
    throw new Error('Client not found');
  }

  return org as {
    id: string;
    business_id?: string | null;
    slug: string;
  };
}

function buildSupportUrl(token: string) {
  const path = pathsConfig.app.publicSupportSubmit.replace('[token]', token);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}${path}` : path;
}

export const ensureClientOrgForCrmClientAction = enhanceAction(
  async (input: { accountId: string; clientId: string }) => {
    await assertAccountManager(input.accountId);
    const client = getSupabaseServerClient();
    const service = createWebsitesService(client);
    const resolved = await service.resolveOrCreateClientOrgForCrmClient(
      input.accountId,
      input.clientId,
    );
    return { clientOrgId: resolved.clientOrgId };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid(),
    }),
  },
);

export const getClientSupportLinkAction = enhanceAction(
  async (input: {
    accountId: string;
    clientOrgId: string;
    accountSlug: string;
  }) => {
    await assertCanManageClientOrg(input.accountId, input.clientOrgId);
    const token = await ensureClientOrgSupportToken(input.clientOrgId);
    return {
      token,
      url: buildSupportUrl(token),
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientOrgId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const rotateClientSupportLinkAction = enhanceAction(
  async (input: {
    accountId: string;
    clientOrgId: string;
    accountSlug: string;
  }) => {
    await assertCanManageClientOrg(input.accountId, input.clientOrgId);
    const token = await rotateClientOrgSupportToken(input.clientOrgId);
    revalidatePath(
      pathsConfig.app.accountClients.replace('[account]', input.accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountSupport.replace('[account]', input.accountSlug),
    );
    return {
      token,
      url: buildSupportUrl(token),
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientOrgId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);
