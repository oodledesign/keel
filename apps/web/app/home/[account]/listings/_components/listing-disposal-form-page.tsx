'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { updateDeal } from '~/home/(user)/pipeline/actions';
import { bindListingToActiveSopAssist } from '~/home/[account]/sops/_components/sop-tracker-widget';

import {
  type ListingFormState,
  formStateToListingPayload,
} from '../_lib/listing-form-shared';
import type { CommercialListing } from '../_lib/server/listings.service';
import { updateListing } from '../_lib/server/server-actions';
import { ListingFormFields } from './listing-form-modal';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type ListingDisposalFormPageProps = {
  listing: CommercialListing;
  accountId: string;
  accountSlug: string;
  sopAssistRunId?: string | null;
  pipelineDealId?: string | null;
};

export function ListingDisposalFormPage({
  listing,
  accountId,
  accountSlug,
  sopAssistRunId = null,
  pipelineDealId = null,
}: ListingDisposalFormPageProps) {
  const router = useRouter();
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestForm = useRef<ListingFormState | null>(null);
  const skipNextSave = useRef(true);
  const dealLinkedRef = useRef(false);
  const sopBoundRef = useRef(false);

  const persist = useCallback(
    async (form: ListingFormState) => {
      setAutosaveStatus('saving');
      try {
        const payload = formStateToListingPayload(form);
        await updateListing({
          listingId: listing.id,
          accountId,
          ...payload,
        });
        setAutosaveStatus('saved');

        if (payload.status === 'marketing' && listing.status !== 'marketing') {
          const { maybeNudgeMoveInstructionToCurrent } =
            await import('../_lib/client/marketing-instruction-nudge');
          await maybeNudgeMoveInstructionToCurrent({
            accountId,
            listingId: listing.id,
          });
        }

        if (pipelineDealId && !dealLinkedRef.current) {
          dealLinkedRef.current = true;
          await updateDeal(pipelineDealId, {
            commercialListingId: listing.id,
            accountSlug,
          });
        }
      } catch {
        setAutosaveStatus('error');
      }
    },
    [accountId, accountSlug, listing.id, listing.status, pipelineDealId],
  );

  const scheduleAutosave = useCallback(
    (form: ListingFormState) => {
      latestForm.current = form;
      if (skipNextSave.current) return;

      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        if (latestForm.current) {
          void persist(latestForm.current);
        }
      }, 800);
    },
    [persist],
  );

  useEffect(() => {
    skipNextSave.current = false;
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!sopAssistRunId || sopBoundRef.current) return;
    sopBoundRef.current = true;
    void bindListingToActiveSopAssist({
      accountId,
      accountSlug,
      runId: sopAssistRunId,
      listingId: listing.id,
    }).catch((err) => {
      console.error(err);
      sopBoundRef.current = false;
    });
  }, [accountId, accountSlug, listing.id, sopAssistRunId]);

  const openDisposal = () => {
    const detailPath = pathsConfig.app.accountListingDetail
      .replace('[account]', accountSlug)
      .replace('[id]', listing.id);
    const suffix = sopAssistRunId ? `?sopAssist=${sopAssistRunId}` : '';
    if (sopAssistRunId) {
      router.push(`${detailPath}/media${suffix}`);
      return;
    }
    router.push(detailPath);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ListingFormFields
        accountId={accountId}
        accountSlug={accountSlug}
        listing={listing}
        presentation="page"
        autosaveStatus={autosaveStatus}
        onFormChange={scheduleAutosave}
        onDone={openDisposal}
        onClose={() => {
          router.push(
            pathsConfig.app.accountListings.replace('[account]', accountSlug),
          );
        }}
        onSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
