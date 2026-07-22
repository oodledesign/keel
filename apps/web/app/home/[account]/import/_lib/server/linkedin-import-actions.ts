'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '~/home/(user)/_lib/pipeline-constants';
import { createDeal } from '~/home/(user)/pipeline/actions';
import {
  findClientDuplicate,
  type ExistingClientSnapshot,
} from '~/lib/clients/client-import';
import {
  buildLinkedInClientDrafts,
  buildLinkedInPipelineDrafts,
  findClientDuplicatesForDrafts,
  findPipelineDuplicate,
  type LinkedInImportDestination,
} from '~/lib/integrations/linkedin/linkedin-import';

import { createClientsService } from '../../../clients/_lib/server/clients.service';

async function assertWorkspaceMember(accountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    throw new Error('You do not have access to this workspace');
  }
}

async function assertCanEditClients(accountId: string) {
  await assertWorkspaceMember(accountId);

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { createTeamAccountsApi } = await import('@kit/team-accounts/api');
  const api = createTeamAccountsApi(client);
  const hasPermission = await api.hasPermission({
    userId: user.id,
    accountId,
    permission: 'clients.edit',
  });
  if (hasPermission) return;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = membership?.account_role;
  if (role === 'owner' || role === 'admin' || role === 'staff') return;
  throw new Error('You do not have permission to import clients');
}

const importSchema = z.object({
  accountId: z.string().uuid(),
  destination: z.enum(['clients', 'pipeline']),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  stage: z.string().optional().default('lead'),
});

const commitSchema = importSchema.extend({
  accountSlug: z.string().min(1),
  duplicateActions: z.record(
    z.string(),
    z.enum(['keep', 'overwrite', 'create_new']),
  ),
});

export const previewLinkedInImportAction = enhanceAction(
  async (input) => {
    await assertWorkspaceMember(input.accountId);

    if (input.destination === 'clients') {
      await assertCanEditClients(input.accountId);
    }

    const client = getSupabaseServerClient();
    const drafts = buildLinkedInClientDrafts(input.headers, input.rows);
    const pipelineDrafts = buildLinkedInPipelineDrafts(
      input.headers,
      input.rows,
    );

    if (input.destination === 'clients') {
      const { data: existingRows, error } = await client
        .from('clients')
        .select(
          'id, display_name, email, company_name, first_name, last_name, client_type',
        )
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);

      const existing: ExistingClientSnapshot[] = (existingRows ?? []).map(
        (row) => ({
          id: row.id as string,
          displayName: String(row.display_name ?? ''),
          email: (row.email as string | null) ?? null,
          companyName: (row.company_name as string | null) ?? null,
          firstName: (row.first_name as string | null) ?? null,
          lastName: (row.last_name as string | null) ?? null,
          clientType: (row.client_type as string | null) ?? null,
        }),
      );

      const duplicates = findClientDuplicatesForDrafts(drafts, existing);

      return {
        destination: 'clients' as LinkedInImportDestination,
        previewRows: drafts.map((draft) => ({
          id: String(draft.rowIndex),
          label:
            draft.clientType === 'business'
              ? draft.companyName || `Row ${draft.rowIndex + 1}`
              : [draft.firstName, draft.lastName].filter(Boolean).join(' ') ||
                `Row ${draft.rowIndex + 1}`,
          detail: [
            draft.email,
            draft.contact?.role,
            draft.contact?.email,
          ]
            .filter(Boolean)
            .join(' · '),
          errors: draft.errors,
          warnings:
            !draft.email && !draft.contact?.email
              ? ['No email on this LinkedIn connection']
              : [],
        })),
        duplicateRows: duplicates.map((dup) => {
          const draft = drafts.find((item) => item.rowIndex === dup.rowIndex);
          return {
            id: String(dup.rowIndex),
            incomingLabel:
              draft?.companyName ||
              [draft?.firstName, draft?.lastName].filter(Boolean).join(' ') ||
              draft?.email ||
              `Row ${dup.rowIndex + 1}`,
            existingLabel:
              dup.existing.displayName || dup.existing.email || dup.existing.id,
            matchReason: dup.matchReason,
          };
        }),
        validCount: drafts.filter((item) => item.errors.length === 0).length,
        errorCount: drafts.filter((item) => item.errors.length > 0).length,
      };
    }

    const { data: existingDeals, error: dealsError } = await client
      .from('pipeline_deals')
      .select('id, contact_name, company_name')
      .eq('account_id', input.accountId);

    if (dealsError) throw new Error(dealsError.message);

    const existingDealsList = (existingDeals ?? []).map((row) => ({
      id: row.id as string,
      contactName: (row.contact_name as string | null) ?? null,
      companyName: (row.company_name as string | null) ?? null,
    }));

    const duplicates = pipelineDrafts
      .map((draft) => findPipelineDuplicate(draft, existingDealsList))
      .filter(
        (match): match is NonNullable<typeof match> => match !== null,
      );

    return {
      destination: 'pipeline' as LinkedInImportDestination,
      previewRows: pipelineDrafts.map((draft) => ({
        id: String(draft.rowIndex),
        label: draft.contactName || `Row ${draft.rowIndex + 1}`,
        detail: [draft.companyName, draft.position, draft.email]
          .filter(Boolean)
          .join(' · '),
        errors: draft.errors,
        warnings: draft.warnings,
      })),
      duplicateRows: duplicates.map((dup) => {
        const draft = pipelineDrafts.find(
          (item) => item.rowIndex === dup.rowIndex,
        );
        return {
          id: String(dup.rowIndex),
          incomingLabel:
            [draft?.contactName, draft?.companyName]
              .filter(Boolean)
              .join(' · ') || `Row ${dup.rowIndex + 1}`,
          existingLabel: dup.existingLabel,
          matchReason: dup.matchReason,
        };
      }),
      validCount: pipelineDrafts.filter((item) => item.errors.length === 0)
        .length,
      errorCount: pipelineDrafts.filter((item) => item.errors.length > 0)
        .length,
    };
  },
  { schema: importSchema },
);

export const commitLinkedInImportAction = enhanceAction(
  async (input) => {
    await assertWorkspaceMember(input.accountId);

    if (input.destination === 'clients') {
      await assertCanEditClients(input.accountId);
    }

    const client = getSupabaseServerClient();
    const service = createClientsService(client);

    if (input.destination === 'clients') {
      const drafts = buildLinkedInClientDrafts(input.headers, input.rows);

      const { data: existingRows, error } = await client
        .from('clients')
        .select(
          'id, display_name, email, company_name, first_name, last_name, client_type',
        )
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);

      const existing: ExistingClientSnapshot[] = (existingRows ?? []).map(
        (row) => ({
          id: row.id as string,
          displayName: String(row.display_name ?? ''),
          email: (row.email as string | null) ?? null,
          companyName: (row.company_name as string | null) ?? null,
          firstName: (row.first_name as string | null) ?? null,
          lastName: (row.last_name as string | null) ?? null,
          clientType: (row.client_type as string | null) ?? null,
        }),
      );

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const failed: Array<{ rowIndex: number; error: string }> = [];

      for (const draft of drafts) {
        try {
          if (draft.errors.length) {
            failed.push({
              rowIndex: draft.rowIndex,
              error: draft.errors.join('; '),
            });
            continue;
          }

          const match = findClientDuplicate(draft, existing);
          const action = match
            ? (input.duplicateActions[String(draft.rowIndex)] ?? 'keep')
            : 'create_new';

          if (action === 'keep') {
            skipped += 1;
            continue;
          }

          if (action === 'overwrite') {
            if (!match) {
              failed.push({
                rowIndex: draft.rowIndex,
                error: 'Overwrite requires a matched existing client',
              });
              continue;
            }

            await service.updateClient({
              accountId: input.accountId,
              clientId: match.existing.id,
              first_name: draft.firstName ?? undefined,
              last_name: draft.lastName,
              company_name: draft.companyName,
              email: draft.email,
              phone: draft.phone,
            });
            updated += 1;
            continue;
          }

          await service.createClient({
            accountId: input.accountId,
            client_type: draft.clientType,
            first_name: draft.firstName ?? undefined,
            last_name: draft.lastName ?? undefined,
            company_name: draft.companyName ?? undefined,
            email: draft.email ?? undefined,
            phone: draft.phone ?? undefined,
            contact: draft.contact
              ? {
                  firstName: draft.contact.firstName,
                  lastName: draft.contact.lastName,
                  email: draft.contact.email,
                  phone: draft.contact.phone,
                  role: draft.contact.role,
                  isPrimary: true,
                }
              : undefined,
          });
          imported += 1;
        } catch (err) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: err instanceof Error ? err.message : 'Failed to import row',
          });
        }
      }

      const clientsPath = pathsConfig.app.accountClients.replace(
        '[account]',
        input.accountSlug,
      );
      revalidatePath(clientsPath, 'page');

      return {
        destination: 'clients' as const,
        imported,
        updated,
        skipped,
        failed,
      };
    }

    const drafts = buildLinkedInPipelineDrafts(input.headers, input.rows);
    const businessId = `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${input.accountId}`;

    const { data: existingDeals, error: dealsError } = await client
      .from('pipeline_deals')
      .select('id, contact_name, company_name')
      .eq('account_id', input.accountId);

    if (dealsError) throw new Error(dealsError.message);

    const existingDealsList = (existingDeals ?? []).map((row) => ({
      id: row.id as string,
      contactName: (row.contact_name as string | null) ?? null,
      companyName: (row.company_name as string | null) ?? null,
    }));

    let imported = 0;
    let skipped = 0;
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (const draft of drafts) {
      try {
        if (draft.errors.length) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: draft.errors.join('; '),
          });
          continue;
        }

        const match = findPipelineDuplicate(draft, existingDealsList);
        const action = match
          ? (input.duplicateActions[String(draft.rowIndex)] ?? 'keep')
          : 'create_new';

        if (action === 'keep') {
          skipped += 1;
          continue;
        }

        const nextActionParts = [
          'LinkedIn import',
          draft.position,
          draft.connectedOn ? `Connected ${draft.connectedOn}` : null,
        ].filter(Boolean);

        const result = await createDeal({
          contactName: draft.contactName,
          companyName: draft.companyName,
          value: 0,
          stage: input.stage,
          nextAction: nextActionParts.join(' · '),
          businessId,
          accountId: input.accountId,
          accountSlug: input.accountSlug,
        });

        if (!result.success) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: result.error ?? 'Could not create deal',
          });
          continue;
        }

        imported += 1;
      } catch (err) {
        failed.push({
          rowIndex: draft.rowIndex,
          error: err instanceof Error ? err.message : 'Failed to import row',
        });
      }
    }

    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', input.accountSlug),
      'page',
    );

    return {
      destination: 'pipeline' as const,
      imported,
      updated: 0,
      skipped,
      failed,
    };
  },
  { schema: commitSchema },
);
