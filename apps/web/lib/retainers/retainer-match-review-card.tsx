'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Plus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type { RetainerMatchSuggestion, RetainerServiceRecord } from './types';
import {
  addProposedRetainerServiceAction,
  applyRetainerMatchAction,
  skipRetainerMatchAction,
} from './review.actions';

export function RetainerMatchReviewCard({
  suggestion,
  services,
  accountSlug,
  onResolved,
}: {
  suggestion: RetainerMatchSuggestion;
  services: RetainerServiceRecord[];
  accountSlug?: string;
  onResolved: () => void;
}) {
  const [serviceId, setServiceId] = useState(suggestion.serviceId ?? '');
  const [showPropose, setShowPropose] = useState(
    suggestion.matchKind === 'propose_new',
  );
  const [proposedName, setProposedName] = useState(
    suggestion.proposedName ?? '',
  );
  const [proposedDescription, setProposedDescription] = useState(
    suggestion.proposedDescription ?? '',
  );
  const [proposedCost, setProposedCost] = useState(
    String(suggestion.proposedCreditCost ?? suggestion.creditCost ?? 1),
  );
  const [pending, startTransition] = useTransition();

  const activeServices = useMemo(
    () => services.filter((row) => row.isActive),
    [services],
  );

  const selected = activeServices.find((row) => row.id === serviceId);
  const cost =
    selected?.creditCost ??
    suggestion.creditCost ??
    (showPropose ? Number(proposedCost) || 1 : null);

  const kindLabel =
    suggestion.matchKind === 'project_service'
      ? 'Project service'
      : suggestion.matchKind === 'workspace_service'
        ? 'Add from catalogue'
        : suggestion.matchKind === 'propose_new'
          ? 'Proposed new service'
          : 'Uncategorised';

  function run(kind: 'apply' | 'skip' | 'propose') {
    startTransition(async () => {
      try {
        if (kind === 'skip') {
          await skipRetainerMatchAction({
            suggestionId: suggestion.id,
            accountSlug,
          });
          toast.success('Task created without using credits');
        } else if (kind === 'propose') {
          const creditCost = Number(proposedCost);
          if (!proposedName.trim() || !Number.isFinite(creditCost) || creditCost < 1) {
            toast.error('Name and a credit cost of at least 1 are required');
            return;
          }
          await addProposedRetainerServiceAction({
            suggestionId: suggestion.id,
            accountSlug,
            name: proposedName.trim(),
            description: proposedDescription.trim() || undefined,
            creditCost: Math.round(creditCost),
            applyAfter: true,
          });
          toast.success('Service added and credits applied');
        } else {
          await applyRetainerMatchAction({
            suggestionId: suggestion.id,
            accountSlug,
            serviceId: serviceId || null,
            addServiceToProject: suggestion.matchKind === 'workspace_service',
          });
          toast.success(
            cost ? `Task created · ${cost} credit${cost === 1 ? '' : 's'} used` : 'Task created',
          );
        }
        onResolved();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update match',
        );
      }
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[var(--ozer-accent)]">
            {kindLabel}
            {typeof suggestion.confidence === 'number'
              ? ` · ${Math.round(suggestion.confidence * 100)}%`
              : ''}
          </p>
          <p className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
            {selected?.name ??
              suggestion.serviceName ??
              suggestion.proposedName ??
              'No service selected'}
            {cost ? ` · ${cost} credit${cost === 1 ? '' : 's'}` : ''}
          </p>
          {suggestion.rationale ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              {suggestion.rationale}
            </p>
          ) : null}
        </div>
      </div>

      {activeServices.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs">Change service</Label>
          <select
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.target.value);
              setShowPropose(false);
            }}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            disabled={pending}
          >
            <option value="">Uncategorised</option>
            {activeServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.creditCost}c
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showPropose ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">New service name</Label>
            <Input
              value={proposedName}
              onChange={(event) => setProposedName(event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={proposedDescription}
              onChange={(event) => setProposedDescription(event.target.value)}
              className="min-h-[64px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Suggested credit cost</Label>
            <Input
              type="number"
              min={1}
              value={proposedCost}
              onChange={(event) => setProposedCost(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showPropose ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => run('propose')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add proposed service
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending || (!serviceId && suggestion.matchKind !== 'uncategorised')}
            onClick={() => run('apply')}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Apply
          </Button>
        )}
        {!showPropose && suggestion.matchKind === 'propose_new' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setShowPropose(true)}
          >
            Add proposed service
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run('skip')}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}
