'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  publishToEach,
  publishToRightmove,
  setEachListingFeedInclusion,
} from '~/lib/commercial/portal-publishers';
import {
  ensureEachFeedToken,
  ensurePropertyHiveFeedToken,
  rotateEachFeedToken,
  rotatePropertyHiveFeedToken,
} from '~/lib/commercial/property-hive-feed';
import {
  getPropertyHiveCredentials,
  persistPropertyHivePublicationError,
  pushListingToPropertyHive,
  savePropertyHiveCredentials,
} from '~/lib/commercial/property-hive-sync';

import {
  EnsureEachFeedSchema,
  EnsurePropertyHiveFeedSchema,
  RotateEachFeedSchema,
  RotatePropertyHiveFeedSchema,
  SavePortalCredentialsSchema,
  SavePropertyHiveCredentialsSchema,
  SaveRightmoveWorkspaceBranchesSchema,
  SetEachListingFeedInclusionSchema,
  TestPublishListingSchema,
} from '../schema/commercial-publishing.schema';
import { loadCommercialPublishingSettings } from './commercial-publishing.loader';

/** Untyped until `pnpm supabase:web:typegen` includes commercial_* tables. */
function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
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

    // Rightmove: OAuth env + workspace branch IDs. EACH: dedicated XML feed.
    // Legacy EACH credential saves are no-ops.
    void input.portal;
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
      if (input.portal !== 'property_hive' && input.portal !== 'each') {
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
          const message =
            'Property Hive XML feed is not enabled yet. Click “Enable XML feed” above.';
          if (input.listingId) {
            try {
              await persistPropertyHivePublicationError({
                accountId: input.accountId,
                listingId: input.listingId,
                lastError: message,
              });
            } catch {
              /* card still shows the returned error */
            }
          }
          return {
            ok: false as const,
            error: message,
            message,
          };
        }

        if (!input.listingId) {
          return {
            ok: false as const,
            message:
              'Property Hive XML feed is not enabled yet. Click “Enable XML feed” above.',
          };
        }

        try {
          const result = await pushListingToPropertyHive(
            input.accountId,
            input.listingId,
          );
          return {
            ok: true as const,
            message: `Pushed to Property Hive (id ${result.externalId})`,
            externalUrl: result.externalUrl,
          };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Property Hive push failed';
          try {
            await persistPropertyHivePublicationError({
              accountId: input.accountId,
              listingId: input.listingId,
              lastError: message,
            });
          } catch {
            /* card still shows the returned error */
          }
          return {
            ok: false as const,
            error: message,
            message,
          };
        }
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

      // EACH uses a dedicated Kato XML feed URL (separate token from Property Hive).
      const settings = await loadCommercialPublishingSettings(input.accountId);
      const feedUrl = settings.each.feedUrl;

      if (!feedUrl) {
        return {
          ok: false as const,
          message:
            'EACH XML feed is not enabled yet. Enable it under Portal publishing → EACH.',
        };
      }

      if (!input.listingId) {
        return {
          ok: true as const,
          message:
            'EACH feed is ready. Send them this dedicated URL (not the Property Hive one).',
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

      const { data: eachPub } = await db()
        .from('commercial_portal_publications')
        .select('status')
        .eq('listing_id', input.listingId)
        .eq('account_id', input.accountId)
        .eq('portal', 'each')
        .maybeSingle();

      const name = listing.name as string;
      if ((eachPub?.status as string | undefined) === 'unpublished') {
        return {
          ok: false as const,
          message: `"${name}" is switched Off for EACH — turn EACH on for this disposal (Management / Overview) to include it in the feed.`,
          feedUrl,
        };
      }

      const publication = await publishToEach(input.accountId, input.listingId);
      const meta = publication.metadata ?? {};
      const note = typeof meta.note === 'string' ? meta.note : null;
      return {
        ok: publication.status !== 'error',
        message:
          publication.last_error ??
          note ??
          (publication.status === 'published'
            ? 'Ready on the EACH XML feed'
            : 'EACH feed link recorded'),
        feedUrl,
        externalUrl: publication.external_url,
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

export const ensureEachFeedAction = enhanceAction(
  async (input) => {
    const result = await ensureEachFeedToken(input.accountId);
    return {
      feedUrl: result.feedUrl,
      created: result.created,
      settings: await loadCommercialPublishingSettings(input.accountId),
    };
  },
  { schema: EnsureEachFeedSchema },
);

export const rotateEachFeedAction = enhanceAction(
  async (input) => {
    const result = await rotateEachFeedToken(input.accountId);
    return {
      feedUrl: result.feedUrl,
      settings: await loadCommercialPublishingSettings(input.accountId),
    };
  },
  { schema: RotateEachFeedSchema },
);

export const setEachListingFeedInclusionAction = enhanceAction(
  async (input) => {
    const publication = await setEachListingFeedInclusion({
      accountId: input.accountId,
      listingId: input.listingId,
      enabled: input.enabled,
    });
    return {
      publication,
      enabled: publication.status !== 'unpublished',
    };
  },
  { schema: SetEachListingFeedInclusionSchema },
);
