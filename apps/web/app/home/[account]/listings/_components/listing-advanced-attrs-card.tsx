'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import {
  BREEAM_RATINGS,
  BREEAM_RATING_LABELS,
  LISTING_CONTROLLED_BY,
  LISTING_CONTROLLED_BY_LABELS,
  LISTING_SIZE_ACCURACIES,
  LISTING_SIZE_ACCURACY_LABELS,
  LISTING_SIZE_BREAKDOWNS,
  LISTING_SIZE_BREAKDOWN_LABELS,
  type BreeamRating,
  type ListingControlledBy,
  type ListingSizeAccuracy,
  type ListingSizeBreakdown,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { updateListing } from '../_lib/server/server-actions';

function toDateInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${trimmed}T12:00:00.000Z`;
}

export function ListingAdvancedAttrsCard({
  accountId,
  listing: initial,
}: {
  accountId: string;
  listing: CommercialListing;
}) {
  const [pending, startTransition] = useTransition();
  const [referenceNumber, setReferenceNumber] = useState(
    initial.referenceNumber ?? '',
  );
  const [projectCode, setProjectCode] = useState(initial.projectCode ?? '');
  const [onMarketAt, setOnMarketAt] = useState(toDateInput(initial.onMarketAt));
  const [offMarketAt, setOffMarketAt] = useState(
    toDateInput(initial.offMarketAt),
  );
  const [averageFloorPlateSqft, setAverageFloorPlateSqft] = useState(
    initial.averageFloorPlateSqft != null
      ? String(initial.averageFloorPlateSqft)
      : '',
  );
  const [sizeBreakdown, setSizeBreakdown] = useState<
    ListingSizeBreakdown | 'unset'
  >((initial.sizeBreakdown as ListingSizeBreakdown | null) ?? 'unset');
  const [controlledBy, setControlledBy] = useState<
    ListingControlledBy | 'unset'
  >((initial.controlledBy as ListingControlledBy | null) ?? 'unset');
  const [sizeAccuracy, setSizeAccuracy] = useState<
    ListingSizeAccuracy | 'unset'
  >((initial.sizeAccuracy as ListingSizeAccuracy | null) ?? 'unset');
  const [termsInternal, setTermsInternal] = useState(
    initial.termsInternal ?? '',
  );
  const [breeamRating, setBreeamRating] = useState<BreeamRating | 'unset'>(
    (initial.breeamRating as BreeamRating | null) ?? 'unset',
  );
  const [conditionDescription, setConditionDescription] = useState(
    initial.conditionDescription ?? '',
  );

  const save = () => {
    startTransition(async () => {
      try {
        const plate = averageFloorPlateSqft.trim();
        await updateListing({
          accountId,
          listingId: initial.id,
          referenceNumber: referenceNumber.trim() || null,
          projectCode: projectCode.trim() || null,
          onMarketAt: fromDateInput(onMarketAt),
          offMarketAt: fromDateInput(offMarketAt),
          averageFloorPlateSqft: plate ? Number(plate) : null,
          sizeBreakdown: sizeBreakdown === 'unset' ? null : sizeBreakdown,
          controlledBy: controlledBy === 'unset' ? null : controlledBy,
          sizeAccuracy: sizeAccuracy === 'unset' ? null : sizeAccuracy,
          termsInternal: termsInternal.trim() || null,
          breeamRating: breeamRating === 'unset' ? null : breeamRating,
          conditionDescription: conditionDescription.trim() || null,
        });
        toast.success('Advanced attributes saved');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Advanced property attributes
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Internal reference, market dates, and property detail fields.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="reference-number">Reference number</Label>
            <Input
              id="reference-number"
              value={referenceNumber}
              disabled={pending}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-code">Project code</Label>
            <Input
              id="project-code"
              value={projectCode}
              disabled={pending}
              onChange={(e) => setProjectCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="on-market-date">On market date</Label>
            <Input
              id="on-market-date"
              type="date"
              value={onMarketAt}
              disabled={pending}
              onChange={(e) => setOnMarketAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="off-market-date">Off market date</Label>
            <Input
              id="off-market-date"
              type="date"
              value={offMarketAt}
              disabled={pending}
              onChange={(e) => setOffMarketAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avg-floor-plate">Average floor plate size</Label>
            <div className="flex gap-2">
              <Input
                id="avg-floor-plate"
                type="number"
                min={0}
                step="any"
                value={averageFloorPlateSqft}
                disabled={pending}
                onChange={(e) => setAverageFloorPlateSqft(e.target.value)}
              />
              <span className="flex items-center text-sm text-[var(--workspace-shell-text)]/50">
                sq ft
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Breakdown</Label>
            <Select
              value={sizeBreakdown}
              disabled={pending}
              onValueChange={(value) =>
                setSizeBreakdown(value as ListingSizeBreakdown | 'unset')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Please select…" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem value="unset" className={workspaceSelectItemClass}>
                  Please select…
                </SelectItem>
                {LISTING_SIZE_BREAKDOWNS.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className={workspaceSelectItemClass}
                  >
                    {LISTING_SIZE_BREAKDOWN_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Controlled by</Label>
            <Select
              value={controlledBy}
              disabled={pending}
              onValueChange={(value) =>
                setControlledBy(value as ListingControlledBy | 'unset')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Please select…" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem value="unset" className={workspaceSelectItemClass}>
                  Please select…
                </SelectItem>
                {LISTING_CONTROLLED_BY.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className={workspaceSelectItemClass}
                  >
                    {LISTING_CONTROLLED_BY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Accuracy</Label>
            <Select
              value={sizeAccuracy}
              disabled={pending}
              onValueChange={(value) =>
                setSizeAccuracy(value as ListingSizeAccuracy | 'unset')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Please select…" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem value="unset" className={workspaceSelectItemClass}>
                  Please select…
                </SelectItem>
                {LISTING_SIZE_ACCURACIES.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className={workspaceSelectItemClass}
                  >
                    {LISTING_SIZE_ACCURACY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BREEAM rating</Label>
            <Select
              value={breeamRating}
              disabled={pending}
              onValueChange={(value) =>
                setBreeamRating(value as BreeamRating | 'unset')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Please select…" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem value="unset" className={workspaceSelectItemClass}>
                  Please select…
                </SelectItem>
                {BREEAM_RATINGS.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className={workspaceSelectItemClass}
                  >
                    {BREEAM_RATING_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="terms-internal">Terms (internal comment)</Label>
            <Input
              id="terms-internal"
              value={termsInternal}
              disabled={pending}
              onChange={(e) => setTermsInternal(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="condition-description">
              Condition (description)
            </Label>
            <Input
              id="condition-description"
              value={conditionDescription}
              disabled={pending}
              onChange={(e) => setConditionDescription(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          disabled={pending}
          className={workspaceBtnPrimaryMd}
          onClick={save}
        >
          Save attributes
        </Button>
      </CardContent>
    </Card>
  );
}
