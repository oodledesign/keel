'use client';

import { type ReactNode, useState } from 'react';

import { MapPin } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { AddressSearchField } from '~/components/commercial/address-search-field';
import {
  SURVEYOR_LEAD_SOURCES,
  SURVEYOR_LEAD_SURVEY_TYPES,
  SURVEYOR_LEAD_TENURES,
} from '~/lib/building-surveyor/surveyor-lead';
import {
  type SurveyorLeadDraft,
  applyAddressSuggestion,
  leadAddressLine,
} from '~/lib/building-surveyor/surveyor-lead-draft';
import { workspaceLinkAccent, workspaceTextMuted } from '~/lib/workspace-ui';

import type { SurveyorMember } from './surveyor-stage-ticks';

const controlClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]';

const selectClass =
  'h-9 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 text-sm text-[var(--workspace-shell-text)] disabled:opacity-60';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-[var(--workspace-shell-text-muted)]">
        {label}
      </Label>
      {children}
    </div>
  );
}

type Props = {
  idPrefix: string;
  value: SurveyorLeadDraft;
  onChange: (next: SurveyorLeadDraft) => void;
  members: SurveyorMember[];
  stages: ReadonlyArray<{ key: string; label: string }>;
  disabled?: boolean;
};

/** The Bracketts instruction sheet, shared by the new-lead dialog, popup and full page. */
export function SurveyorLeadFields({
  idPrefix,
  value,
  onChange,
  members,
  stages,
  disabled,
}: Props) {
  const [manualAddress, setManualAddress] = useState(false);
  const set = <K extends keyof SurveyorLeadDraft>(
    key: K,
    next: SurveyorLeadDraft[K],
  ) => onChange({ ...value, [key]: next });
  const id = (name: string) => `${idPrefix}-${name}`;
  const text = (name: keyof SurveyorLeadDraft, placeholder?: string) => (
    <Input
      id={id(name)}
      value={value[name]}
      onChange={(event) => set(name, event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={controlClass}
    />
  );

  const addressLine = leadAddressLine(value);
  const showAddressSummary = Boolean(addressLine) && !manualAddress;

  return (
    <div className="space-y-6">
      <Section title="Instruction">
        <div className="space-y-1.5">
          <span className="text-sm text-[var(--workspace-shell-text-muted)]">
            Instruction type
          </span>
          <div
            role="radiogroup"
            aria-label="Instruction type"
            className="inline-flex flex-wrap gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1 text-xs"
          >
            {SURVEYOR_LEAD_SURVEY_TYPES.map((option) => {
              const active = value.surveyType === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => set('surveyType', active ? '' : option.key)}
                  className={cn(
                    'rounded-full px-3 py-1.5 font-medium transition-colors',
                    active
                      ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                      : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={id('stage')} label="Stage">
            <select
              id={id('stage')}
              className={selectClass}
              value={value.stage}
              disabled={disabled}
              onChange={(event) => set('stage', event.target.value)}
            >
              {stages.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={id('assignedTo')} label="Surveyor">
            <select
              id={id('assignedTo')}
              className={selectClass}
              value={value.assignedTo}
              disabled={disabled}
              onChange={(event) => set('assignedTo', event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={id('inspectionDate')} label="Inspection date">
            <Input
              id={id('inspectionDate')}
              type="date"
              value={value.inspectionDate}
              onChange={(event) => set('inspectionDate', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field id={id('inspectionTime')} label="Inspection time">
            <Input
              id={id('inspectionTime')}
              type="time"
              value={value.inspectionTime}
              onChange={(event) => set('inspectionTime', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field id={id('leadInTime')} label="Lead-in time">
            {text('leadInTime', 'e.g. 2 weeks')}
          </Field>
        </div>
      </Section>

      <Section title="Property">
        {showAddressSummary ? (
          <div className="flex items-start gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--workspace-shell-text)]">
                {addressLine}
              </p>
              {value.postcode ? (
                <p className={`text-xs ${workspaceTextMuted}`}>
                  {value.postcode}
                </p>
              ) : null}
            </div>
            {!disabled ? (
              <button
                type="button"
                className={`shrink-0 text-xs ${workspaceLinkAccent}`}
                onClick={() => setManualAddress(true)}
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : manualAddress ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={id('addressLine1')}
              label="Address line 1"
              className="sm:col-span-2"
            >
              {text('addressLine1')}
            </Field>
            <Field
              id={id('addressLine2')}
              label="Address line 2"
              className="sm:col-span-2"
            >
              {text('addressLine2')}
            </Field>
            <Field id={id('town')} label="Town">
              {text('town')}
            </Field>
            <Field id={id('postcode')} label="Postcode">
              {text('postcode')}
            </Field>
            <button
              type="button"
              className={`justify-self-start text-xs ${workspaceLinkAccent}`}
              onClick={() => setManualAddress(false)}
            >
              Search for the address instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <AddressSearchField
              label="Property address"
              hint={null}
              onSelect={(suggestion) =>
                onChange(applyAddressSuggestion(value, suggestion))
              }
            />
            <button
              type="button"
              className={`text-xs ${workspaceLinkAccent}`}
              onClick={() => setManualAddress(true)}
            >
              Enter address manually
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={id('propertyType')} label="Property type">
            {text('propertyType', 'e.g. Semi-detached house')}
          </Field>
          <Field id={id('propertyAge')} label="Age">
            {text('propertyAge', 'e.g. 1930s')}
          </Field>
          <Field id={id('bedrooms')} label="Bedrooms">
            <Input
              id={id('bedrooms')}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={value.bedrooms}
              onChange={(event) => set('bedrooms', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field id={id('purchasePrice')} label="Purchase price (£)">
            <Input
              id={id('purchasePrice')}
              inputMode="decimal"
              value={value.purchasePrice}
              onChange={(event) => set('purchasePrice', event.target.value)}
              placeholder="450000"
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field id={id('tenure')} label="Tenure">
            <select
              id={id('tenure')}
              className={selectClass}
              value={value.tenure}
              disabled={disabled}
              onChange={(event) => set('tenure', event.target.value)}
            >
              <option value="">Not known</option>
              {SURVEYOR_LEAD_TENURES.map((tenure) => (
                <option key={tenure} value={tenure}>
                  {tenure}
                </option>
              ))}
              {value.tenure &&
              !(SURVEYOR_LEAD_TENURES as readonly string[]).includes(
                value.tenure,
              ) ? (
                <option value={value.tenure}>{value.tenure}</option>
              ) : null}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Access">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={id('accessContactName')} label="Access contact">
            {text('accessContactName', 'Agent or vendor')}
          </Field>
          <Field id={id('accessContactPhone')} label="Access phone">
            {text('accessContactPhone')}
          </Field>
        </div>
      </Section>

      <Section title="Client">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={id('contactName')} label="Client name(s) *">
            {text('contactName', 'Full name(s)')}
          </Field>
          <Field id={id('source')} label="Source">
            <select
              id={id('source')}
              className={selectClass}
              value={value.source}
              disabled={disabled}
              onChange={(event) => set('source', event.target.value)}
            >
              <option value="">Select</option>
              {SURVEYOR_LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
              {value.source &&
              !(SURVEYOR_LEAD_SOURCES as readonly string[]).includes(
                value.source,
              ) ? (
                <option value={value.source}>{value.source}</option>
              ) : null}
            </select>
          </Field>
          <Field id={id('contactPhone')} label="Phone">
            {text('contactPhone')}
          </Field>
          <Field id={id('contactEmail')} label="Email">
            <Input
              id={id('contactEmail')}
              type="email"
              value={value.contactEmail}
              onChange={(event) => set('contactEmail', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field
            id={id('clientAddress')}
            label="Client address"
            className="sm:col-span-2"
          >
            {text('clientAddress', 'If different from the property')}
          </Field>
        </div>
      </Section>

      <Section title="Fee and notes">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={id('fee')} label="Fee (£, plus VAT)">
            <Input
              id={id('fee')}
              inputMode="decimal"
              value={value.fee}
              onChange={(event) => set('fee', event.target.value)}
              placeholder="650"
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <div className="hidden sm:block" />
          <Field id={id('solicitorName')} label="Solicitor">
            {text('solicitorName')}
          </Field>
          <Field id={id('solicitorEmail')} label="Solicitor email">
            <Input
              id={id('solicitorEmail')}
              type="email"
              value={value.solicitorEmail}
              onChange={(event) => set('solicitorEmail', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field
            id={id('comments')}
            label="Comments and special concerns"
            className="sm:col-span-2"
          >
            <Textarea
              id={id('comments')}
              rows={3}
              value={value.comments}
              onChange={(event) => set('comments', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
          <Field
            id={id('clientNotes')}
            label="Client notes"
            className="sm:col-span-2"
          >
            <Textarea
              id={id('clientNotes')}
              rows={3}
              value={value.clientNotes}
              onChange={(event) => set('clientNotes', event.target.value)}
              disabled={disabled}
              className={controlClass}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
