'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { resolveClientOrgAccountId } from '~/lib/support/resolve-client-org-account';
import {
  ensureClientOrgSupportToken,
  rotateClientOrgSupportToken,
} from '~/lib/support/public-support.service';

import { createWebsitesService } from '../../../websites/_lib/server/websites.service';

async function assertCanManageClientOrg(clientOrgId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: org } = await client
    .from('client_orgs')
    .select('id, business_id, slug')
    .eq('id', clientOrgId)
    .maybeSingle();

  if (!org) throw new Error('Client not found');

  const accountId = await resolveClientOrgAccountId(
    client,
    org as { business_id?: string | null },
  );
  if (!accountId) throw new Error('Client workspace not found');

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

  return org as {
    id: string;
    business_id?: string | null;
    slug: string;
  };
}

export const ensureClientOrgForCrmClientAction = enhanceAction(
  async (input: { accountId: string; clientId: string }) => {
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
  async (input: { clientOrgId: string; accountSlug: string }) => {
    await assertCanManageClientOrg(input.clientOrgId);
    const token = await ensureClientOrgSupportToken(input.clientOrgId);
    const path = pathsConfig.app.publicSupportSubmit.replace('[token]', token);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
    return {
      token,
      url: base ? `${base}${path}` : path,
    };
  },
  {
    schema: z.object({
      clientOrgId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const rotateClientSupportLinkAction = enhanceAction(
  async (input: { clientOrgId: string; accountSlug: string }) => {
    await assertCanManageClientOrg(input.clientOrgId);
    const token = await rotateClientOrgSupportToken(input.clientOrgId);
    revalidatePath(
      pathsConfig.app.accountClients.replace('[account]', input.accountSlug),
    );
    const path = pathsConfig.app.publicSupportSubmit.replace('[token]', token);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
    return {
      token,
      url: base ? `${base}${path}` : path,
    };
  },
  {
    schema: z.object({
      clientOrgId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);
