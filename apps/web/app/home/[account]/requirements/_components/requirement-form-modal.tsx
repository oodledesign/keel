'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { handleAiCreditsFailure } from '~/components/ai/handle-ai-credits-failure';
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from '~/lib/commercial/commercial-constants';
import {
  REQUIREMENT_LOCATION_RADIUS_OPTIONS,
  REQUIREMENT_PROPERTY_TYPES,
  radiusSelectValue,
} from '~/lib/commercial/requirement-form-fields';
import { normalizeRequirementUseClass } from '~/lib/commercial/requirement-use-class';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  ClientContactPicker,
  type ClientContactPickerValue,
  emptyClientContactPickerValue,
} from '../../clients/_components/client-contact-picker';
import { CommercialInterestPanel } from '../../listings/_components/commercial-interest-panel';
import { WipAttachmentsStrip } from '../../pipeline/_components/wip-attachments-strip';
import type { RequirementDraftPrefill } from '../_lib/schema/requirements.schema';
import { draftRequirementFromPaste } from '../_lib/server/requirement-draft-actions';
import type { CommercialRequirement } from '../_lib/server/requirements.service';
import {
  createRequirement,
  listRequirementOffices,
  updateRequirement,
} from '../_lib/server/server-actions';

interface RequirementFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountSlug?: string | null;
  requirement?: CommercialRequirement | null;
  initialDraft?: RequirementDraftPrefill | null;
  sourceEnquiryId?: string | null;
  /** Open the paste-to-draft panel immediately (WIP "Draft from email"). */
  openPastePanel?: boolean;
  onSaved: () => void;
}

type OfficeOption = { id: string; name: string; isDefault: boolean };

type BriefForm = {
  locationText: string;
  searchRadiusMiles: string;
  branchId: string;
  sector: string;
  tenure: '' | 'rent' | 'buy' | 'both';
  sizeMinSqft: string;
  sizeMaxSqft: string;
  budgetMin: string;
  budgetMax: string;
  stage: RequirementStatus;
  detailsSent: boolean;
  detailsNote: string;
  notes: string;
  source: string;
};

function partyFromDraft(
  draft?: RequirementDraftPrefill | null,
): ClientContactPickerValue {
  if (!draft) return emptyClientContactPickerValue();
  return {
    clientId: '',
    contactId: '',
    companyName: draft.companyName ?? '',
    contactName: draft.contactName ?? '',
    contactEmail: draft.contactEmail ?? '',
    contactPhone: draft.contactPhone ?? '',
  };
}

function partyFromRequirement(
  requirement?: CommercialRequirement | null,
): ClientContactPickerValue {
  if (!requirement) return emptyClientContactPickerValue();
  return {
    clientId: requirement.clientId ?? '',
    contactId: requirement.contactId ?? '',
    companyName: requirement.companyName ?? '',
    contactName: requirement.contactName ?? '',
    contactEmail: requirement.contactEmail ?? '',
    contactPhone: requirement.contactPhone ?? '',
  };
}

function briefFromDraft(draft?: RequirementDraftPrefill | null): BriefForm {
  if (!draft) {
    return {
      locationText: '',
      searchRadiusMiles: '10',
      branchId: '',
      sector: '',
      tenure: '',
      sizeMinSqft: '',
      sizeMaxSqft: '',
      budgetMin: '',
      budgetMax: '',
      stage: 'new',
      detailsSent: false,
      detailsNote: '',
      notes: '',
      source: '',
    };
  }

  return {
    locationText: draft.locationText ?? '',
    searchRadiusMiles: '10',
    branchId: '',
    sector: draft.sector ?? '',
    tenure: draft.tenure ?? '',
    sizeMinSqft: draft.sizeMinSqft != null ? String(draft.sizeMinSqft) : '',
    sizeMaxSqft: draft.sizeMaxSqft != null ? String(draft.sizeMaxSqft) : '',
    budgetMin:
      draft.budgetMinPence != null ? String(draft.budgetMinPence / 100) : '',
    budgetMax:
      draft.budgetMaxPence != null ? String(draft.budgetMaxPence / 100) : '',
    stage: 'new',
    detailsSent: false,
    detailsNote: '',
    notes: draft.notes ?? '',
    source: draft.source ?? '',
  };
}

function briefFromRequirement(
  requirement?: CommercialRequirement | null,
): BriefForm {
  if (!requirement) {
    return briefFromDraft(null);
  }

  return {
    locationText: requirement.locationText ?? '',
    searchRadiusMiles:
      requirement.searchRadiusMiles != null
        ? radiusSelectValue(requirement.searchRadiusMiles)
        : '10',
    branchId: requirement.branchId ?? '',
    sector: requirement.sector ?? '',
    tenure: requirement.tenure ?? '',
    sizeMinSqft:
      requirement.sizeMinSqft != null ? String(requirement.sizeMinSqft) : '',
    sizeMaxSqft:
      requirement.sizeMaxSqft != null ? String(requirement.sizeMaxSqft) : '',
    budgetMin:
      requirement.budgetMinPence != null
        ? String(requirement.budgetMinPence / 100)
        : '',
    budgetMax:
      requirement.budgetMaxPence != null
        ? String(requirement.budgetMaxPence / 100)
        : '',
    stage: requirement.stage,
    detailsSent: requirement.detailsSent,
    detailsNote: requirement.detailsNote ?? '',
    notes: requirement.notes ?? '',
    source: requirement.source ?? '',
  };
}

function RequirementFormFields({
  accountId,
  requirement,
  initialDraft,
  sourceEnquiryId,
  openPastePanel = false,
  onClose,
  onSaved,
}: {
  accountId: string;
  requirement?: CommercialRequirement | null;
  initialDraft?: RequirementDraftPrefill | null;
  sourceEnquiryId?: string | null;
  openPastePanel?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    reportExhausted,
    accountId: creditsAccountId,
    billingHref,
  } = useAiCreditsExhausted();
  const isEdit = Boolean(requirement);
  const [isPending, startTransition] = useTransition();
  const [draftPending, startDraft] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(openPastePanel && !requirement);
  const [pasteText, setPasteText] = useState('');
  const [party, setParty] = useState(() =>
    requirement
      ? partyFromRequirement(requirement)
      : partyFromDraft(initialDraft),
  );
  const [form, setForm] = useState(() =>
    requirement
      ? briefFromRequirement(requirement)
      : briefFromDraft(initialDraft),
  );
  const [linkedEnquiryId] = useState(sourceEnquiryId ?? null);
  const [offices, setOffices] = useState<OfficeOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    listRequirementOffices({ accountId })
      .then((rows) => {
        if (!cancelled) setOffices(rows);
      })
      .catch(() => {
        if (!cancelled) setOffices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const field = <K extends keyof BriefForm>(key: K, value: BriefForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const applyDraft = (draft: RequirementDraftPrefill) => {
    setParty(partyFromDraft(draft));
    setForm(briefFromDraft(draft));
    setPasteOpen(false);
    setPasteText('');
    toast.success('Draft applied — link a contact and save to confirm');
  };

  const runPasteDraft = () => {
    if (!pasteText.trim()) {
      setError('Paste an enquiry email or message first');
      return;
    }
    setError(null);
    startDraft(async () => {
      try {
        const draft = await draftRequirementFromPaste({
          accountId,
          text: pasteText,
        });
        applyDraft(draft);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not draft requirement';
        if (
          handleAiCreditsFailure(reportExhausted, {
            accountId: creditsAccountId || accountId,
            billingHref,
            message,
          })
        ) {
          return;
        }
        setError(message);
        toast.error(message);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!party.clientId) {
      setError('Link a contact, or create one below.');
      return;
    }

    startTransition(async () => {
      try {
        const shared = {
          clientId: party.clientId || null,
          contactId: party.contactId || null,
          companyName: party.companyName.trim() || null,
          contactName: party.contactName.trim() || null,
          contactEmail: party.contactEmail.trim() || null,
          contactPhone: party.contactPhone.trim() || null,
          locationText: form.locationText.trim() || null,
          searchRadiusMiles:
            form.searchRadiusMiles.trim() === ''
              ? null
              : parseFloat(form.searchRadiusMiles),
          branchId: form.branchId || null,
          sector: form.sector.trim() || null,
          useClass: normalizeRequirementUseClass(form.sector.trim() || null),
          tenure: form.tenure || null,
          sizeMinSqft: form.sizeMinSqft ? parseFloat(form.sizeMinSqft) : null,
          sizeMaxSqft: form.sizeMaxSqft ? parseFloat(form.sizeMaxSqft) : null,
          budgetMinPence: form.budgetMin
            ? Math.round(parseFloat(form.budgetMin) * 100)
            : null,
          budgetMaxPence: form.budgetMax
            ? Math.round(parseFloat(form.budgetMax) * 100)
            : null,
          stage: form.stage,
          detailsSent: form.detailsSent,
          detailsNote: form.detailsNote.trim() || null,
          notes: form.notes.trim() || null,
          source: form.source.trim() || null,
        };

        if (isEdit && requirement) {
          await updateRequirement({
            requirementId: requirement.id,
            accountId,
            ...shared,
          });
        } else {
          await createRequirement({
            accountId,
            ...shared,
            sourceEnquiryId: linkedEnquiryId,
          });
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {!isEdit ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--workspace-shell-text)]/55">
              Draft from an enquiry email, then confirm before saving.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPasteOpen((v) => !v)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Draft from email
            </Button>
          </div>
          {pasteOpen ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder="Paste enquiry email or message…"
                className={inputClass}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPasteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={draftPending}
                  className={workspaceBtnPrimaryMd}
                  onClick={runPasteDraft}
                >
                  {draftPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Drafting…
                    </>
                  ) : (
                    'Generate draft'
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <ClientContactPicker
        accountId={accountId}
        active
        value={party}
        onChange={setParty}
        onError={setError}
        showSummary
        allowNone={false}
        terminology="commercial"
      />

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input
          value={form.locationText}
          onChange={(e) => field('locationText', e.target.value)}
          placeholder="Areas / towns / postcode"
          className={inputClass}
        />
        <p className="text-[11px] text-[var(--workspace-shell-text)]/45">
          Location is geocoded automatically on save when coordinates are
          missing.
        </p>
        {requirement?.latitude != null && requirement?.longitude != null ? (
          <p className="text-[11px] text-[var(--workspace-shell-text)]/45 tabular-nums">
            Coords: {requirement.latitude.toFixed(5)},{' '}
            {requirement.longitude.toFixed(5)}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Search radius</Label>
        <Select
          value={form.searchRadiusMiles || '10'}
          onValueChange={(v) => field('searchRadiusMiles', v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUIREMENT_LOCATION_RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.miles} value={String(option.miles)}>
                {option.label}
              </SelectItem>
            ))}
            {form.searchRadiusMiles &&
            !REQUIREMENT_LOCATION_RADIUS_OPTIONS.some(
              (option) => String(option.miles) === form.searchRadiusMiles,
            ) ? (
              <SelectItem value={form.searchRadiusMiles}>
                {form.searchRadiusMiles} miles
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      {offices.length > 0 ? (
        <div className="space-y-1.5">
          <Label>Office</Label>
          <Select
            value={form.branchId || 'unset'}
            onValueChange={(v) => field('branchId', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="Any office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Any office</SelectItem>
              {offices.map((office) => (
                <SelectItem key={office.id} value={office.id}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tenure</Label>
          <Select
            value={form.tenure || 'unset'}
            onValueChange={(v) =>
              field('tenure', v === 'unset' ? '' : (v as BriefForm['tenure']))
            }
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="buy">FH</SelectItem>
              <SelectItem value="rent">LH</SelectItem>
              <SelectItem value="both">FH / LH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Stage</Label>
          <Select
            value={form.stage}
            onValueChange={(v) => field('stage', v as RequirementStatus)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUIREMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUIREMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Min sq ft</Label>
          <Input
            type="number"
            min={0}
            value={form.sizeMinSqft}
            onChange={(e) => field('sizeMinSqft', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max sq ft</Label>
          <Input
            type="number"
            min={0}
            value={form.sizeMaxSqft}
            onChange={(e) => field('sizeMaxSqft', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Budget min (£)</Label>
          <Input
            type="number"
            min={0}
            value={form.budgetMin}
            onChange={(e) => field('budgetMin', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Budget max (£)</Label>
          <Input
            type="number"
            min={0}
            value={form.budgetMax}
            onChange={(e) => field('budgetMax', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Property type</Label>
        <Select
          value={form.sector || 'all'}
          onValueChange={(v) => field('sector', v === 'all' ? '' : v)}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="All property types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All property types</SelectItem>
            {REQUIREMENT_PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
            {form.sector &&
            !(REQUIREMENT_PROPERTY_TYPES as readonly string[]).includes(
              form.sector,
            ) ? (
              <SelectItem value={form.sector}>{form.sector}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="requirement-details-sent"
            checked={form.detailsSent}
            onCheckedChange={(checked) =>
              field('detailsSent', checked === true)
            }
          />
          <Label htmlFor="requirement-details-sent" className="font-normal">
            Details sent
          </Label>
        </div>
        {form.detailsSent ? (
          <Input
            value={form.detailsNote}
            onChange={(e) => field('detailsNote', e.target.value)}
            placeholder="What was sent (optional)"
            className={inputClass}
          />
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => field('notes', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending || draftPending}
          className={workspaceBtnPrimaryMd}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add requirement'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RequirementFormModal({
  open,
  onClose,
  accountId,
  accountSlug,
  requirement,
  initialDraft,
  sourceEnquiryId,
  openPastePanel = false,
  onSaved,
}: RequirementFormModalProps) {
  const draftKey = initialDraft
    ? JSON.stringify(initialDraft).slice(0, 80)
    : 'blank';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>
            {requirement
              ? 'Edit requirement'
              : initialDraft
                ? 'Review requirement draft'
                : openPastePanel
                  ? 'Draft requirement from email'
                  : 'Add requirement'}
          </DialogTitle>
        </DialogHeader>
        {open ? (
          <RequirementFormFields
            key={
              requirement?.id ??
              `${sourceEnquiryId ?? 'new'}-${draftKey}-${openPastePanel ? 'paste' : 'form'}`
            }
            accountId={accountId}
            requirement={requirement}
            initialDraft={initialDraft}
            sourceEnquiryId={sourceEnquiryId}
            openPastePanel={openPastePanel}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
        {open && requirement?.id ? (
          <>
            <WipAttachmentsStrip
              accountId={accountId}
              accountSlug={accountSlug}
              commercialRequirementId={requirement.id}
            />
            <CommercialInterestPanel
              accountId={accountId}
              mode={{ kind: 'requirement', requirementId: requirement.id }}
              compact
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
