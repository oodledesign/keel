'use client';

import Link from 'next/link';

import { Maximize2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { workspaceLinkAccent } from '~/lib/workspace-ui';

import {
  type SurveyorLeadContext,
  SurveyorLeadPanel,
} from './surveyor-lead-panel';

export function SurveyorLeadDialog({
  open,
  onOpenChange,
  context,
  deal,
  defaultStage,
  onSaved,
  onDealChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SurveyorLeadContext;
  /** Null opens the new-lead form. */
  deal: PipelineDeal | null;
  defaultStage?: string;
  onSaved: (deal: PipelineDeal, created: boolean) => void;
  onDealChange?: (deal: PipelineDeal) => void;
}) {
  const title = deal
    ? deal.contactName || deal.companyName || 'Lead'
    : 'New lead';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[92vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
          deal ? 'sm:max-w-5xl' : 'sm:max-w-2xl',
        )}
        data-test="surveyor-lead-dialog"
      >
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-8">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="truncate">{title}</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              {deal
                ? deal.companyName || 'Instruction sheet'
                : 'Fill in the instruction sheet. You can add the rest later.'}
            </DialogDescription>
          </div>
          {deal ? (
            <Link
              href={pathsConfig.app.accountPipelineLead
                .replace('[account]', context.accountSlug)
                .replace('[dealId]', deal.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${workspaceLinkAccent}`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full page
            </Link>
          ) : null}
        </DialogHeader>
        {open ? (
          <SurveyorLeadPanel
            key={deal?.id ?? 'new'}
            context={context}
            deal={deal}
            defaultStage={defaultStage}
            onSaved={(saved) => onSaved(saved, !deal)}
            onDealChange={onDealChange}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
