'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  WORKSPACE_FORM_DESTINATION_LABELS,
  WORKSPACE_FORM_FIELD_TYPES,
  WORKSPACE_FORM_FIELD_TYPE_LABELS,
  type WorkspaceFormDestination,
  type WorkspaceFormField,
  type WorkspaceFormFieldType,
  createWorkspaceFormField,
  ensureListingField,
} from '~/lib/workspace-forms/form-fields';
import {
  WORKSPACE_FORM_PAGE_BACKGROUNDS,
  WORKSPACE_FORM_PAGE_BACKGROUND_LABELS,
  type WorkspaceFormPageBackground,
} from '~/lib/workspace-forms/form-theme';
import { ensureMailingListFields } from '~/lib/workspace-forms/mailing-list-fields';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  deleteWorkspaceFormAction,
  publishWorkspaceFormAction,
  updateWorkspaceFormAction,
} from '../_lib/server/server-actions';
import type {
  ListingOption,
  WorkspaceFormRecord,
} from '../_lib/server/workspace-forms.service';
import type { WorkspaceFormSubmissionRecord } from '../_lib/server/workspace-forms.service';
import { FormSharePanel } from './form-share-panel';
import { FormSubmissionsList } from './form-submissions-list';

type Props = {
  accountSlug: string;
  form: WorkspaceFormRecord;
  listings: ListingOption[];
  submissions: WorkspaceFormSubmissionRecord[];
  showListingDestination: boolean;
};

export function FormBuilder({
  accountSlug,
  form,
  listings,
  submissions,
  showListingDestination,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? '');
  const [destination, setDestination] = useState(form.destination);
  const [listingId, setListingId] = useState(form.listingId ?? '');
  const [submitLabel, setSubmitLabel] = useState(form.submitLabel);
  const [successMessage, setSuccessMessage] = useState(
    form.successMessage ?? '',
  );
  const [fields, setFields] = useState(form.fields);
  const [enabled, setEnabled] = useState(form.enabled);
  const [pageBackground, setPageBackground] =
    useState<WorkspaceFormPageBackground>(form.theme.pageBackground);

  function updateField(id: string, patch: Partial<WorkspaceFormField>) {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  }

  function moveField(id: string, direction: -1 | 1) {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [moved] = copy.splice(index, 1);
      if (!moved) return current;
      copy.splice(next, 0, moved);
      return copy;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        await updateWorkspaceFormAction({
          accountId: form.accountId,
          formId: form.id,
          name: name.trim() || 'Untitled form',
          description: description.trim() || null,
          destination,
          listingId: listingId || null,
          submitLabel: submitLabel.trim() || 'Submit',
          successMessage: successMessage.trim() || null,
          fields,
          enabled,
          theme: { pageBackground },
        });
        toast.success('Form saved');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save form',
        );
      }
    });
  }

  function togglePublished(nextEnabled: boolean) {
    setEnabled(nextEnabled);
    startTransition(async () => {
      try {
        await publishWorkspaceFormAction({
          accountId: form.accountId,
          formId: form.id,
          enabled: nextEnabled,
        });
        toast.success(nextEnabled ? 'Form published' : 'Form unpublished');
        router.refresh();
      } catch (error) {
        setEnabled(!nextEnabled);
        toast.error(
          error instanceof Error ? error.message : 'Could not update form',
        );
      }
    });
  }

  function onDelete() {
    if (!window.confirm('Delete this form and its submissions?')) return;
    startTransition(async () => {
      try {
        await deleteWorkspaceFormAction({
          accountId: form.accountId,
          formId: form.id,
        });
        toast.success('Form deleted');
        router.push(`/app/${accountSlug}/forms`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete form',
        );
      }
    });
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <section className={`${workspacePanelCard} space-y-4 p-5`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="form-name">Form name</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              data-test="form-name-input"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Destination</Label>
            <Select
              value={destination}
              onValueChange={(value) => {
                const next = value as WorkspaceFormDestination;
                setDestination(next);
                if (next === 'mailing_list') {
                  setFields((current) =>
                    ensureMailingListFields(current, {
                      commercial: showListingDestination,
                    }),
                  );
                }
                if (next === 'listing_enquiry') {
                  setFields((current) => ensureListingField(current));
                }
              }}
            >
              <SelectTrigger data-test="form-destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">
                  {WORKSPACE_FORM_DESTINATION_LABELS.pipeline}
                </SelectItem>
                <SelectItem value="mailing_list">
                  {WORKSPACE_FORM_DESTINATION_LABELS.mailing_list}
                </SelectItem>
                <SelectItem value="submission_list">
                  {WORKSPACE_FORM_DESTINATION_LABELS.submission_list}
                </SelectItem>
                {showListingDestination || destination === 'listing_enquiry' ? (
                  <SelectItem value="listing_enquiry">
                    {WORKSPACE_FORM_DESTINATION_LABELS.listing_enquiry}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="form-description">Intro</Label>
          <Textarea
            id="form-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </div>

        {destination === 'listing_enquiry' ||
        (destination === 'mailing_list' && showListingDestination) ? (
          <div className="grid gap-1.5">
            <Label>
              {destination === 'mailing_list'
                ? 'Default listing (optional)'
                : 'Default listing'}
            </Label>
            <Select
              value={listingId || 'none'}
              onValueChange={(value) =>
                setListingId(value === 'none' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Bind from embed URL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Bind from URL or hidden field
                </SelectItem>
                {listings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className={`text-xs ${workspaceTextMuted}`}>
              {destination === 'mailing_list'
                ? 'Optional. Property Hive templates can bind this form to a disposal with'
                : 'Property-page embeds can still override this with'}
              <code className="mx-1">?listing=</code>
              or <code>data-listing</code>.
            </p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>Page background</Label>
          <RadioGroup
            value={pageBackground}
            onValueChange={(value) =>
              setPageBackground(value as WorkspaceFormPageBackground)
            }
            className="grid gap-2 sm:grid-cols-2"
            data-test="form-page-background"
          >
            {WORKSPACE_FORM_PAGE_BACKGROUNDS.map((value) => {
              const meta = WORKSPACE_FORM_PAGE_BACKGROUND_LABELS[value];
              const selected = pageBackground === value;
              return (
                <RadioGroupItemLabel
                  key={value}
                  selected={selected}
                  className="h-full items-start gap-3 space-x-0"
                >
                  <RadioGroupItem value={value} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className={`font-medium ${workspaceText}`}>
                      {meta.label}
                    </span>
                    <span className={`text-xs ${workspaceTextMuted}`}>
                      {meta.description}
                    </span>
                  </span>
                </RadioGroupItemLabel>
              );
            })}
          </RadioGroup>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="submit-label">Submit button</Label>
            <Input
              id="submit-label"
              value={submitLabel}
              onChange={(event) => setSubmitLabel(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="success-message">Success message</Label>
            <Input
              id="success-message"
              value={successMessage}
              onChange={(event) => setSuccessMessage(event.target.value)}
              placeholder="Thank you — we have received your enquiry."
            />
          </div>
        </div>
      </section>

      <section className={`${workspacePanelCard} space-y-4 p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={`text-base font-semibold ${workspaceText}`}>Fields</h2>
          <Select
            onValueChange={(value) =>
              setFields((current) => [
                ...current,
                createWorkspaceFormField(
                  value as WorkspaceFormFieldType,
                  current,
                ),
              ])
            }
          >
            <SelectTrigger className="w-[180px]" data-test="add-form-field">
              <SelectValue placeholder="Add field" />
            </SelectTrigger>
            <SelectContent>
              {WORKSPACE_FORM_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    {WORKSPACE_FORM_FIELD_TYPE_LABELS[type]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4"
            >
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-1.5">
                  <Label>Label</Label>
                  <Input
                    value={field.label}
                    onChange={(event) =>
                      updateField(field.id, { label: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Input
                    value={WORKSPACE_FORM_FIELD_TYPE_LABELS[field.type]}
                    readOnly
                  />
                </div>
                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => moveField(field.id, -1)}
                    aria-label="Move field up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(field.id, 1)}
                    aria-label="Move field down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setFields((current) =>
                        current.filter((item) => item.id !== field.id),
                      )
                    }
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <label
                  className={`flex items-center gap-2 text-sm ${workspaceText}`}
                >
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      updateField(field.id, { required: checked })
                    }
                  />
                  Required
                </label>
                <span className={`text-xs ${workspaceTextMuted}`}>
                  key: {field.key}
                </span>
              </div>

              {field.type === 'select' ? (
                <div className="mt-3 grid gap-1.5">
                  <Label>Options (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={(field.options ?? []).join('\n')}
                    onChange={(event) =>
                      updateField(field.id, {
                        options: event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <FormSharePanel
        shareToken={form.shareToken}
        enabled={enabled}
        destination={destination}
        listingId={listingId || null}
        pending={pending}
        onToggle={togglePublished}
        showPropertyHiveSnippet={showListingDestination}
      />

      <FormSubmissionsList
        accountSlug={accountSlug}
        submissions={submissions}
        destination={destination}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onDelete}
        >
          Delete form
        </Button>
        <Button
          type="button"
          className={`${workspaceBtnPrimary} rounded-xl`}
          disabled={pending}
          onClick={save}
          data-test="save-form-button"
        >
          {pending ? 'Saving…' : 'Save form'}
        </Button>
      </div>
    </div>
  );
}
