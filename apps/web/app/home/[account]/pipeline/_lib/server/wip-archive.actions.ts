'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { revalidateMatchRequirementsCache } from '~/lib/cache/disposals-data-cache';
import { requireAccountAdminActor } from '~/lib/commercial/require-account-admin-actor';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';

const ScopeSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  id: z.string().uuid(),
});

const ListArchivedSchema = z.object({
  accountId: z.string().uuid(),
});

type Table = 'pipeline_deals' | 'commercial_requirements';

export type ArchivedInstruction = {
  id: string;
  name: string;
  stage: string;
  archivedAt: string;
};

export type ArchivedRequirement = {
  id: string;
  name: string;
  stage: string;
  archivedAt: string;
};

export type ArchivedWip = {
  instructions: ArchivedInstruction[];
  requirements: ArchivedRequirement[];
};

function revalidateWip(accountId: string, accountSlug?: string) {
  revalidatePath('/home/pipeline');
  revalidatePath('/home');
  if (accountSlug) {
    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountRequirements.replace('[account]', accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountHome.replace('[account]', accountSlug),
    );
  }
  revalidateMatchRequirementsCache(accountId);
}

async function setArchived(
  table: Table,
  input: z.infer<typeof ScopeSchema>,
  archived: boolean,
) {
  await requireCommercialBillableActor(
    input.accountId,
    archived ? 'archive records' : 'restore records',
  );

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // archived_* columns may lag generated Database types until typegen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from(table)
    .update(
      archived
        ? { archived_at: new Date().toISOString(), archived_by: user?.id }
        : { archived_at: null, archived_by: null },
    )
    .eq('id', input.id)
    .eq('account_id', input.accountId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      'Record not found, or you do not have access to change it.',
    );
  }

  revalidateWip(input.accountId, input.accountSlug);
  return { success: true as const };
}

async function deleteForever(table: Table, input: z.infer<typeof ScopeSchema>) {
  await requireAccountAdminActor(input.accountId, 'permanently delete records');

  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from(table)
    .delete()
    .eq('id', input.id)
    .eq('account_id', input.accountId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      'Record not found, or you do not have access to delete it.',
    );
  }

  revalidateWip(input.accountId, input.accountSlug);
  return { success: true as const };
}

export const archiveInstruction = enhanceAction(
  async (input) => setArchived('pipeline_deals', input, true),
  { schema: ScopeSchema },
);

export const restoreInstruction = enhanceAction(
  async (input) => setArchived('pipeline_deals', input, false),
  { schema: ScopeSchema },
);

export const deleteInstructionForever = enhanceAction(
  async (input) => deleteForever('pipeline_deals', input),
  { schema: ScopeSchema },
);

export const archiveRequirement = enhanceAction(
  async (input) => setArchived('commercial_requirements', input, true),
  { schema: ScopeSchema },
);

export const restoreRequirement = enhanceAction(
  async (input) => setArchived('commercial_requirements', input, false),
  { schema: ScopeSchema },
);

export const deleteRequirementForever = enhanceAction(
  async (input) => deleteForever('commercial_requirements', input),
  { schema: ScopeSchema },
);

type ArchivedDealRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  contact_name: string | null;
  stage: string;
  archived_at: string;
};

type ArchivedRequirementRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  stage: string;
  archived_at: string;
};

const ARCHIVED_LIMIT = 200;

export const listArchivedWip = enhanceAction(
  async (input): Promise<ArchivedWip> => {
    const client = getSupabaseServerClient();
    // archived_at may lag generated Database types until typegen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;

    const [dealsResult, requirementsResult] = await Promise.all([
      db
        .from('pipeline_deals')
        .select('id, name, company_name, contact_name, stage, archived_at')
        .eq('account_id', input.accountId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(ARCHIVED_LIMIT),
      db
        .from('commercial_requirements')
        .select('id, company_name, contact_name, stage, archived_at')
        .eq('account_id', input.accountId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(ARCHIVED_LIMIT),
    ]);

    if (dealsResult.error) throw new Error(dealsResult.error.message);
    if (requirementsResult.error) {
      throw new Error(requirementsResult.error.message);
    }

    return {
      instructions: ((dealsResult.data ?? []) as ArchivedDealRow[]).map(
        (row) => ({
          id: row.id,
          name:
            row.name?.trim() ||
            row.company_name?.trim() ||
            row.contact_name?.trim() ||
            'Untitled instruction',
          stage: row.stage,
          archivedAt: row.archived_at,
        }),
      ),
      requirements: (
        (requirementsResult.data ?? []) as ArchivedRequirementRow[]
      ).map((row) => ({
        id: row.id,
        name:
          row.company_name?.trim() ||
          row.contact_name?.trim() ||
          'Untitled requirement',
        stage: row.stage,
        archivedAt: row.archived_at,
      })),
    };
  },
  { schema: ListArchivedSchema },
);
