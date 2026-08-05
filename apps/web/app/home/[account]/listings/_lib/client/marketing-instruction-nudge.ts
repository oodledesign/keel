'use client';

import { toast } from '@kit/ui/sonner';

import { moveDealToStage } from '~/home/(user)/pipeline/actions';

import {
  listPotentialInstructionsForListing,
  movePotentialInstructionsToCurrent,
} from '../server/marketing-instruction-actions';

/**
 * After a disposal flips to marketing, ask whether linked Potential
 * Instructions should move to Current.
 */
export async function maybeNudgeMoveInstructionToCurrent(input: {
  accountId: string;
  listingId: string;
  accountSlug?: string | null;
}) {
  try {
    const deals = await listPotentialInstructionsForListing(input);
    if (deals.length === 0) return;

    const label =
      deals.length === 1
        ? `“${deals[0]!.name}” is still on Potential.`
        : `${deals.length} linked instructions are still on Potential.`;

    toast.message('Move instruction to Current?', {
      description: `${label} Disposals on marketing are usually Current Instructions.`,
      duration: 12000,
      action: {
        label: deals.length === 1 ? 'Move to Current' : 'Move all',
        onClick: () => {
          void (async () => {
            try {
              if (deals.length === 1) {
                const result = await moveDealToStage(deals[0]!.id, 'current', {
                  accountSlug: input.accountSlug,
                });
                if (!result.success) {
                  toast.error(result.error ?? 'Could not move instruction');
                  return;
                }
              } else {
                await movePotentialInstructionsToCurrent({
                  accountId: input.accountId,
                  listingId: input.listingId,
                  accountSlug: input.accountSlug,
                });
              }
              toast.success('Moved to Current Instructions');
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Could not move instruction',
              );
            }
          })();
        },
      },
    });
  } catch (error) {
    console.error('[listings] marketing instruction nudge failed', error);
  }
}
