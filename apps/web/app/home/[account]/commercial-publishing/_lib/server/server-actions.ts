'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  decryptCommercialSecret,
  encryptCommercialSecret,
} from '~/lib/commercial/commercial-crypto';
import {
  publishToEach,
  publishToRightmove,
} from '~/lib/commercial/portal-publishers';
import {
  ensurePropertyHiveFeedToken,
  rotatePropertyHiveFeedToken,
} from '~/lib/commercial/property-hive-feed';
import {
  getPropertyHiveCredentials,
  pushListingToPropertyHive,
  savePropertyHiveCredentials,
} from '~/lib/commercial/property-hive-sync';

import {
  EnsurePropertyHiveFeedSchema,
  RotatePropertyHiveFeedSchema,
  SavePortalCredentialsSchema,
  SavePropertyHiveCredentialsSchema,
  SaveRightmoveWorkspaceBranchesSchema,
  TestPublishListingSchema,
} from '../schema/commercial-publishing.schema';
import { loadCommercialPublishingSettings } from './commercial-publishing.loader';

/** Untyped until `pnpm supabase:web:typegen` includes commercial_* tables. */
function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
}

async function getExistingPortalSecret(
  accountId: string,
  portal: 'rightmove' | 'each',
): Promise<string | null> {
  const { data } = await db()
    .from('commercial_portal_credentials')
    .select('secret_ciphertext')
    .eq('account_id', accountId)
    .eq('portal', portal)
    .maybeSingle();

  if (!data?.secret_ciphertext) return null;

  return decryptCommercialSecret(data.secret_ciphertext as string);
}

async function saveAddonPortalCredentials(
  accountId: string,
  portal: 'rightmove' | 'each',
  input: {
    branchId: string;
    networkId?: string | null;
    username?: string;
    secret?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    account_id: accountId,
    portal,
    branch_id: input.branchId.trim(),
    network_id: input.networkId?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.username !== undefined) {
    patch.username = input.username.trim() || null;
  }

  if (input.secret?.trim()) {
    patch.secret_ciphertext = encryptCommercialSecret(input.secret.trim());
  } else if (portal === 'each') {
    // EACH still requires a secret on first save — caller validates.
    const existing = await getExistingPortalSecret(accountId, portal);
    if (!existing) {
      throw new Error('Secret is required');
    }
  }

  const { error } = await db()
    .from('commercial_portal_credentials')
    .upsert(patch, { onConflict: 'account_id,portal' });

  if (error) throw new Error(error.message);
}

export const savePropertyHiveCredentialsAction = enhanceAction(
  async (input) => {
    let password = input.applicationPassword?.trim() ?? '';
    if (!password) {
      const existing = await getPropertyHiveCredentials(input.accountId);
      if (!existing) {
        throw new Error('Application password is required');
      }
      password = existing.applicationPassword;
    }

    await savePropertyHiveCredentials(input.accountId, {
      siteUrl: input.siteUrl,
      username: input.username,
      applicationPassword: password,
      officeId: input.officeId,
    });

    return loadCommercialPublishingSettings(input.accountId);
  },
  { schema: SavePropertyHiveCredentialsSchema },
);

export const savePortalCredentialsAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { assertCommercialPortalPublishingAllowed } =
      await import('~/lib/commercial/commercial-seat-access');
    await assertCommercialPortalPublishingAllowed({
      client,
      accountId: input.accountId,
    });

    if (input.portal === 'rightmove') {
      // Rightmove Branch IDs live on workspace account_branches now.
      return loadCommercialPublishingSettings(input.accountId);
    }

    let secret = input.secret?.trim() ?? '';
    if (!secret) {
      const existing = await getExistingPortalSecret(
        input.accountId,
        input.portal,
      );
      if (!existing) {
        throw new Error('Secret is required');
      }
      secret = existing;
    }

    await saveAddonPortalCredentials(input.accountId, input.portal, {
      branchId: input.branchId!.trim(),
      networkId: input.networkId,
      username: input.username,
      secret,
    });

    return loadCommercialPublishingSettings(input.accountId);
  },
  { schema: SavePortalCredentialsSchema },
);

/**
 * Save Rightmove Branch IDs onto existing workspace offices (account_branches).
 */
export const saveRightmoveWorkspaceBranchesAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { assertCommercialPortalPublishingAllowed } =
      await import('~/lib/commercial/commercial-seat-access');
    await assertCommercialPortalPublishingAllowed({
      client,
      accountId: input.accountId,
    });

    for (const branch of input.branches) {
      const { error } = await db()
        .from('account_branches')
        .update({
          rightmove_branch_id: branch.rightmoveBranchId?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', branch.id)
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);
    }

    return loadCommercialPublishingSettings(input.accountId);
  },
  { schema: SaveRightmoveWorkspaceBranchesSchema },
);

export const testPublishListingAction = enhanceAction(
  async (input) => {
    try {
      if (input.portal !== 'property_hive') {
        const client = getSupabaseServerClient();
        const { assertCommercialPortalPublishingAllowed } =
          await import('~/lib/commercial/commercial-seat-access');
        await assertCommercialPortalPublishingAllowed({
          client,
          accountId: input.accountId,
        });
      }

      if (input.portal === 'property_hive') {
        const settings = await loadCommercialPublishingSettings(
          input.accountId,
        );
        const restConfigured = settings.propertyHive.configured;
        const feedEnabled = settings.propertyHive.feedEnabled;
        const feedUrl = settings.propertyHive.feedUrl;

        // Preferred path: Kato-compatible XML feed (no live WordPress REST push)
        if (feedEnabled && feedUrl) {
          if (!input.listingId) {
            return {
              ok: true as const,
              message:
                'Property Hive XML feed is enabled. Paste the feed URL in Property Hive → Property Import.',
              feedUrl,
            };
          }

          const { data: listing, error: listingError } = await db()
            .from('commercial_listings')
            .select('id, name, status')
            .eq('id', input.listingId)
            .eq('account_id', input.accountId)
            .maybeSingle();

          if (listingError) {
            return { ok: false as const, message: listingError.message };
          }
          if (!listing) {
            return {
              ok: false as const,
              message: 'Listing not found in this workspace',
            };
          }

          const name = listing.name as string;
          const status = listing.status as string;
          const onMarket = status === 'marketing' || status === 'under_offer';

          return {
            ok: true as const,
            message: onMarket
              ? `"${name}" is on-market and will appear in the XML feed on the next Property Hive import.`
              : `"${name}" is ${status} — set status to Marketing or Under offer for it to appear in the feed.`,
            feedUrl,
          };
        }

        if (!restConfigured) {
          return {
            ok: false as const,
            message:
              'Property Hive XML feed is not enabled yet. Click “Enable feed” above, or save WordPress REST credentials for live push.',
          };
        }

        if (!input.listingId) {
          return {
            ok: true as const,
            message: 'Property Hive WordPress credentials are configured',
          };
        }

        const result = await pushListingToPropertyHive(
          input.accountId,
          input.listingId,
        );
        return {
          ok: true as const,
          message: `Pushed to Property Hive (id ${result.externalId})`,
          externalUrl: result.externalUrl,
        };
      }

      if (input.portal === 'rightmove') {
        const { testRightmoveConnection } =
          await import('~/lib/commercial/rightmove-api');
        const settings = await loadCommercialPublishingSettings(
          input.accountId,
        );

        if (!input.listingId) {
          let probeBranchId: string | null = null;
          if (input.accountBranchId) {
            probeBranchId =
              settings.rightmove.workspaceBranches.find(
                (b) => b.id === input.accountBranchId,
              )?.rightmoveBranchId ?? null;
            if (!probeBranchId) {
              return {
                ok: false,
                message:
                  'Selected office has no Rightmove Branch ID — add it under Brand settings → Branches',
              };
            }
          } else {
            probeBranchId =
              settings.rightmove.workspaceBranches.find((b) =>
                Boolean(b.rightmoveBranchId?.trim()),
              )?.rightmoveBranchId ?? null;
          }

          const connection = await testRightmoveConnection({
            branchId: probeBranchId,
          });
          return {
            ok: connection.ok,
            message: connection.message,
          };
        }

        const publication = await publishToRightmove(
          input.accountId,
          input.listingId,
        );
        const meta = publication.metadata ?? {};
        const note = typeof meta.note === 'string' ? meta.note : null;
        return {
          ok: publication.status !== 'error',
          message:
            publication.last_error ??
            note ??
            (publication.status === 'published'
              ? 'Published to Rightmove'
              : 'Rightmove sync recorded'),
          externalUrl: publication.external_url,
        };
      }

      if (!input.listingId) {
        return {
          ok: true as const,
          message: 'Select a listing to test publish',
        };
      }

      const publication = await publishToEach(input.accountId, input.listingId);
      return {
        ok: publication.status !== 'error',
        message: publication.last_error ?? 'EACH publish recorded',
      };
    } catch (error) {
      // Avoid opaque Next.js production digests for business failures.
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : 'Test publish failed unexpectedly',
      };
    }
  },
  { schema: TestPublishListingSchema },
);

export const ensurePropertyHiveFeedAction = enhanceAction(
  async (input) => {
    const result = await ensurePropertyHiveFeedToken(input.accountId);
    return {
      feedUrl: result.feedUrl,
      created: result.created,
      settings: await loadCommercialPublishingSettings(input.accountId),
    };
  },
  { schema: EnsurePropertyHiveFeedSchema },
);

export const rotatePropertyHiveFeedAction = enhanceAction(
  async (input) => {
    const result = await rotatePropertyHiveFeedToken(input.accountId);
    return {
      feedUrl: result.feedUrl,
      settings: await loadCommercialPublishingSettings(input.accountId),
    };
  },
  { schema: RotatePropertyHiveFeedSchema },
);
