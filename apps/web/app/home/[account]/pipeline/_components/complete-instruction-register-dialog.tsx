'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { updateDeal } from '~/home/(user)/pipeline/actions';
import { createLease } from '~/home/[account]/leases/_lib/server/server-actions';
import {
  createListing,
  updateListing,
} from '~/home/[account]/listings/_lib/server/server-actions';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { instructionTitle } from '../_lib/instruction-title';

type Outcome = 'sale' | 'letting';

export function CompleteInstructionRegisterDialog({
  open,
  deal,
  accountId,
  accountSlug,
  onClose,
  onRecorded,
  onCreateDisposal,
}: {
  open: boolean;
  deal: PipelineDeal | null;
  accountId: string;
  accountSlug: string;
  onClose: () => void;
  onRecorded: () => void;
  onCreateDisposal: (deal: PipelineDeal) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>('sale');
  const [propertyLabel, setPropertyLabel] = useState('');
  const [partyName, setPartyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = deal ? instructionTitle(deal) : '';

  const resetAndClose = () => {
    setOutcome('sale');
    setPropertyLabel('');
    setPartyName('');
    setError(null);
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!deal) return;

    const label = propertyLabel.trim() || title;
    if (!label) {
      setError('Add a property name');
      return;
    }

    startTransition(async () => {
      try {
        let listingId = deal.commercialListingId;

        if (listingId) {
          await updateListing({
            listingId,
            accountId,
            status: outcome === 'sale' ? 'sold' : 'let',
          });
        } else if (outcome === 'sale') {
          const listing = await createListing({
            accountId,
            name: label,
            status: 'sold',
            disposalType: 'for_sale',
            instructingClientId: deal.clientId,
            notes: deal.description?.trim() || null,
            askingPricePence:
              deal.value > 0 ? Math.round(deal.value * 100) : null,
          });
          listingId = listing.id;
          await updateDeal(deal.id, {
            commercialListingId: listing.id,
            accountSlug,
          });
        }

        if (outcome === 'letting') {
          await createLease({
            accountId,
            listingId,
            clientId: deal.clientId,
            propertyLabel: label,
            tenantName: partyName.trim() || deal.contactName || null,
            notes: deal.description?.trim() || null,
            status: 'active',
          });
        }

        toast.success(
          outcome === 'sale'
            ? 'Sale added to Sales & lettings'
            : 'Letting added to Sales & lettings',
        );
        resetAndClose();
        onRecorded();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record deal');
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
      }}
    >
      <DialogContent className="max-w-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Record on Sales & lettings?</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            “{title}” is Completed / Exchanged. Add it to the register now, or
            skip and do it later.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOutcome('sale')}
              className={
                outcome === 'sale'
                  ? 'rounded-lg bg-[var(--ozer-plum-950)] px-3 py-2 text-sm font-medium text-[var(--ozer-text-on-dark)]'
                  : 'rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]'
              }
            >
              Sale
            </button>
            <button
              type="button"
              onClick={() => setOutcome('letting')}
              className={
                outcome === 'letting'
                  ? 'rounded-lg bg-[var(--ozer-plum-950)] px-3 py-2 text-sm font-medium text-[var(--ozer-text-on-dark)]'
                  : 'rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]'
              }
            >
              Letting
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Property</Label>
            <Input
              value={propertyLabel}
              onChange={(event) => setPropertyLabel(event.target.value)}
              placeholder={title}
            />
          </div>

          {outcome === 'letting' ? (
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Input
                value={partyName}
                onChange={(event) => setPartyName(event.target.value)}
                placeholder={deal?.contactName || 'Tenant name'}
              />
            </div>
          ) : null}

          {!deal?.commercialListingId && outcome === 'letting' ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              This instruction has no linked disposal. The letting will still be
              added to the register.
            </p>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (deal) onCreateDisposal(deal);
              }}
            >
              Create disposal
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Not now
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
              >
                {pending
                  ? 'Saving…'
                  : outcome === 'sale'
                    ? 'Add sale'
                    : 'Add letting'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
