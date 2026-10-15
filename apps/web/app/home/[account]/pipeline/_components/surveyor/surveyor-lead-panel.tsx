'use client';

import { type ReactNode, useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { createDeal, updateDeal } from '~/home/(user)/pipeline/actions';
import {
  EMPTY_SURVEYOR_LEAD,
  type SurveyorLeadFields,
  type SurveyorTickInput,
  applySurveyorTickInput,
} from '~/lib/building-surveyor/surveyor-lead';
import {
  EMPTY_SURVEYOR_LEAD_DRAFT,
  type SurveyorLeadDraft,
  type SurveyorLeadSaveInput,
  leadAddressLine,
  leadDraftFromDeal,
  leadDraftToSaveInput,
} from '~/lib/building-surveyor/surveyor-lead-draft';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { LeadActivityFeed } from './lead-activity-feed';
import { SurveyorLeadDocuments } from './surveyor-lead-documents';
import { SurveyorLeadFields as LeadFields } from './surveyor-lead-fields';
import {
  type SurveyorMember,
  SurveyorTicksPanel,
} from './surveyor-stage-ticks';

export type SurveyorLeadContext = {
  accountId: string;
  accountSlug: string;
  /** Pipeline target id for new leads (the workspace). */
  businessId: string;
  businessName: string;
  businessColor: string | null;
  members: SurveyorMember[];
  stages: ReadonlyArray<{ key: string; label: string }>;
  currentUserId: string | null;
};

function leadFieldsFromSave(
  base: SurveyorLeadFields,
  save: SurveyorLeadSaveInput,
): SurveyorLeadFields {
  const lead = save.lead;
  const text = (value: string | null | undefined) => value?.trim() || null;
  return {
    ...base,
    assignedTo: lead.assignedTo ?? null,
    surveyType: lead.surveyType ?? null,
    inspectionAt: lead.inspectionAt ?? null,
    leadInTime: text(lead.leadInTime),
    propertyAge: text(lead.propertyAge),
    bedrooms: lead.bedrooms ?? null,
    purchasePricePence: lead.purchasePricePence ?? null,
    tenure: text(lead.tenure),
    accessContactName: text(lead.accessContactName),
    accessContactPhone: text(lead.accessContactPhone),
    clientAddress: text(lead.clientAddress),
    solicitorName: text(lead.solicitorName),
    solicitorEmail: text(lead.solicitorEmail),
    clientNotes: text(lead.clientNotes),
    contactEmail: text(lead.contactEmail),
    contactPhone: text(lead.contactPhone),
    source: text(lead.source),
    lastActivityAt: new Date().toISOString(),
  };
}

/** Local copy of a lead after a save, so the board updates without a reload. */
export function dealFromLeadSave(input: {
  base: PipelineDeal | null;
  id: string;
  save: SurveyorLeadSaveInput;
  context: SurveyorLeadContext;
}): PipelineDeal {
  const { base, id, save, context } = input;
  const lead = leadFieldsFromSave(
    base?.surveyorLead ?? EMPTY_SURVEYOR_LEAD,
    save,
  );
  const shared = {
    contactName: save.contactName,
    companyName: save.companyName,
    value: save.value,
    stage: save.stage,
    description: save.description,
    ...save.property,
    surveyorLead: lead,
  };
  if (base) return { ...base, ...shared };
  return {
    id,
    projectName: null,
    workType: null,
    nextAction: '',
    nextActionDate: null,
    businessId: context.businessId,
    businessName: context.businessName,
    businessColor: context.businessColor,
    clientId: null,
    clientName: null,
    commercialListingId: null,
    hotsRentPsf: null,
    hotsSizeSqft: null,
    hotsLeaseYears: null,
    hotsIncentives: null,
    hotsSolicitorName: null,
    hotsTargetExchangeDate: null,
    hotsNotes: null,
    completedAt: null,
    ladderPosition: 0,
    boardPosition: 0,
    followUpCall: false,
    amlDone: false,
    amlDoneAt: null,
    amlDoneBy: null,
    disposalType: null,
    sizeSqft: null,
    askingRentPence: null,
    askingPricePence: null,
    ...shared,
  };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
      <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

type Props = {
  context: SurveyorLeadContext;
  /** Null to create a new lead. */
  deal: PipelineDeal | null;
  defaultStage?: string;
  layout?: 'dialog' | 'page';
  onSaved: (deal: PipelineDeal) => void;
  /** Ticks save straight away; the parent keeps its copy in step. */
  onDealChange?: (deal: PipelineDeal) => void;
  onCancel?: () => void;
};

/**
 * The lead form with ticks, linked documents and the activity feed. Shared by
 * the popup and the full page.
 */
export function SurveyorLeadPanel({
  context,
  deal,
  defaultStage,
  layout = 'dialog',
  onSaved,
  onDealChange,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<SurveyorLeadDraft>(() =>
    deal
      ? leadDraftFromDeal(deal)
      : {
          ...EMPTY_SURVEYOR_LEAD_DRAFT,
          stage: defaultStage ?? EMPTY_SURVEYOR_LEAD_DRAFT.stage,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const [ticks, setTicks] = useState<SurveyorLeadFields>(
    deal?.surveyorLead ?? EMPTY_SURVEYOR_LEAD,
  );

  useEffect(() => {
    setDraft(
      deal
        ? leadDraftFromDeal(deal)
        : {
            ...EMPTY_SURVEYOR_LEAD_DRAFT,
            stage: defaultStage ?? EMPTY_SURVEYOR_LEAD_DRAFT.stage,
          },
    );
    setTicks(deal?.surveyorLead ?? EMPTY_SURVEYOR_LEAD);
    setError(null);
    // Reset only when a different lead is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id]);

  const save = () => {
    setError(null);
    const input = leadDraftToSaveInput(draft);
    if (!input.contactName) {
      setError('Add the client name');
      return;
    }
    startSaving(async () => {
      if (deal) {
        const result = await updateDeal(deal.id, {
          contactName: input.contactName,
          companyName: input.companyName,
          value: input.value,
          stage: input.stage,
          description: input.description,
          property: input.property,
          lead: input.lead,
          accountSlug: context.accountSlug,
        });
        if (!result.success) {
          setError(result.error ?? 'Could not save the lead');
          return;
        }
        const next = dealFromLeadSave({
          base: { ...deal, surveyorLead: ticks },
          id: deal.id,
          save: input,
          context,
        });
        setRefreshKey((key) => key + 1);
        toast.success('Lead saved');
        onSaved(next);
        return;
      }

      const result = await createDeal({
        contactName: input.contactName,
        companyName: input.companyName,
        value: input.value,
        stage: input.stage,
        description: input.description,
        businessId: context.businessId,
        accountId: context.accountId,
        accountSlug: context.accountSlug,
        property: input.property,
        lead: input.lead,
      });
      if (!result.success || !result.id) {
        setError(result.error ?? 'Could not create the lead');
        return;
      }
      toast.success('Lead added');
      onSaved(
        dealFromLeadSave({ base: null, id: result.id, save: input, context }),
      );
    });
  };

  const changeTicks = (input: SurveyorTickInput) => {
    if (!deal) return;
    const withChecker: SurveyorTickInput =
      input.reportChecked === true && input.reportCheckedBy === undefined
        ? { ...input, reportCheckedBy: context.currentUserId }
        : input;
    const previous = ticks;
    const next = applySurveyorTickInput(ticks, withChecker);
    setTicks(next);
    onDealChange?.({ ...deal, surveyorLead: next });
    void updateDeal(deal.id, {
      ticks: withChecker,
      accountSlug: context.accountSlug,
    }).then((result) => {
      if (!result.success) {
        setTicks(previous);
        onDealChange?.({ ...deal, surveyorLead: previous });
        toast.error(result.error ?? 'Could not save the tick');
        return;
      }
      setRefreshKey((key) => key + 1);
    });
  };

  const form = (
    <LeadFields
      idPrefix={deal ? `lead-${deal.id}` : 'lead-new'}
      value={draft}
      onChange={setDraft}
      members={context.members}
      stages={context.stages}
      disabled={saving}
    />
  );

  const actions = (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <p className="mr-auto text-sm text-rose-500" role="alert">
          {error}
        </p>
      ) : null}
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 text-sm font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
        >
          Cancel
        </button>
      ) : null}
      <button
        type="button"
        className={workspaceBtnPrimaryMd}
        disabled={saving}
        onClick={save}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {deal ? 'Save lead' : 'Add lead'}
      </button>
    </div>
  );

  if (!deal) {
    return (
      <div className="space-y-5">
        {form}
        {actions}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]',
        layout === 'dialog' && 'min-h-0',
      )}
    >
      <div className="min-w-0 space-y-5">
        <Card title="Stage ticks">
          <SurveyorTicksPanel
            stage={draft.stage}
            ticks={ticks}
            members={context.members}
            onChange={changeTicks}
          />
        </Card>
        {form}
        <Card title="Linked documents">
          <SurveyorLeadDocuments
            accountId={context.accountId}
            accountSlug={context.accountSlug}
            dealId={deal.id}
            hasAddress={Boolean(leadAddressLine(deal))}
            refreshKey={refreshKey}
          />
        </Card>
        {actions}
      </div>
      <aside
        className={cn(
          'flex min-h-[320px] flex-col gap-3 border-t border-[color:var(--workspace-shell-border)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6',
          layout === 'dialog' && 'lg:max-h-[70vh]',
        )}
      >
        <div>
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Activity
          </h3>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Stage moves, ticks, reminders and updates.
          </p>
        </div>
        <LeadActivityFeed
          accountId={context.accountId}
          accountSlug={context.accountSlug}
          dealId={deal.id}
          refreshKey={refreshKey}
        />
      </aside>
    </div>
  );
}
