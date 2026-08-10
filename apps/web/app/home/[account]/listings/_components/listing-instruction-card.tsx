'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  TERMS_OF_ENGAGEMENT,
  TERMS_OF_ENGAGEMENT_LABELS,
  type TermsOfEngagement,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { updateListing } from '../_lib/server/server-actions';

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 has-[:checked]:border-[color:var(--ozer-accent)] has-[:checked]:bg-[var(--ozer-accent-subtle)]">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text)]/50">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function ListingInstructionCard({
  accountId,
  listing: initial,
}: {
  accountId: string;
  listing: CommercialListing;
}) {
  const [listing, setListing] = useState(initial);
  const [disposalType, setDisposalType] = useState<DisposalType>(
    initial.disposalType,
  );
  const [isInstructed, setIsInstructed] = useState(initial.isInstructed);
  const [instructionNature, setInstructionNature] = useState<
    'exclusive' | 'joint'
  >(initial.instructionNature);
  const [termsOfEngagement, setTermsOfEngagement] = useState<
    TermsOfEngagement | 'unset'
  >(initial.termsOfEngagement ?? 'unset');
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        const updated = await updateListing({
          accountId,
          listingId: listing.id,
          disposalType,
          isInstructed,
          instructionNature,
          termsOfEngagement:
            termsOfEngagement === 'unset' ? null : termsOfEngagement,
        });
        setListing(updated);
        toast.success('Instruction details saved');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Disposal management & type
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          How this instruction is classified and whether ToE are agreed.
        </p>
      </CardHeader>
      <CardContent className="max-w-xl space-y-5">
        <div className="space-y-2">
          <Label>Type of disposal</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {DISPOSAL_TYPES.map((type) => (
              <RadioOption
                key={type}
                name="disposal-type"
                value={type}
                checked={disposalType === type}
                onChange={() => setDisposalType(type)}
                label={DISPOSAL_TYPE_LABELS[type]}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Are you instructed on this disposal?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioOption
              name="is-instructed"
              value="yes"
              checked={isInstructed}
              onChange={() => setIsInstructed(true)}
              label="Yes"
              description="This is an active instruction"
            />
            <RadioOption
              name="is-instructed"
              value="no"
              checked={!isInstructed}
              onChange={() => setIsInstructed(false)}
              label="No"
              description="Market intel only"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nature of this instruction</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioOption
              name="instruction-nature"
              value="exclusive"
              checked={instructionNature === 'exclusive'}
              onChange={() => setInstructionNature('exclusive')}
              label="Exclusive instruction"
            />
            <RadioOption
              name="instruction-nature"
              value="joint"
              checked={instructionNature === 'joint'}
              onChange={() => setInstructionNature('joint')}
              label="Joint agent instruction"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="toe">Have Terms of Engagement been agreed?</Label>
          <Select
            value={termsOfEngagement}
            onValueChange={(value) =>
              setTermsOfEngagement(value as TermsOfEngagement | 'unset')
            }
          >
            <SelectTrigger id="toe">
              <SelectValue placeholder="Please select…" />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              <SelectItem value="unset" className={workspaceSelectItemClass}>
                Please select…
              </SelectItem>
              {TERMS_OF_ENGAGEMENT.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className={workspaceSelectItemClass}
                >
                  {TERMS_OF_ENGAGEMENT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          disabled={pending}
          className={workspaceBtnPrimaryMd}
          onClick={save}
        >
          Save instruction details
        </Button>
      </CardContent>
    </Card>
  );
}
