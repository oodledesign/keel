'use client';

import { useState, useTransition } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Inbox, ListChecks, Mail, Plus, Settings2, Share2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { cn } from '@kit/ui/utils';

import { WorkspaceRichTextEditor } from '~/components/workspace-rich-text';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import {
  type FormEditorTab,
  formEditorTabHref,
  parseFormEditorTab,
} from '~/lib/workspace-forms/form-editor-tab';
import type {
  FormNotifyMemberOption,
  WorkspaceFormEmailSettings,
} from '~/lib/workspace-forms/form-email';
import {
  WORKSPACE_FORM_DESTINATION_LABELS,
  type WorkspaceFormDestination,
  type WorkspaceFormField,
  applyWorkspaceFormFieldType,
  createWorkspaceFormField,
  duplicateWorkspaceFormField,
  ensureListingField,
  publicVisibleFields,
} from '~/lib/workspace-forms/form-fields';
import {
  fieldHasStepBreakAfter,
  setFieldStepBreakAfter,
  visibleFieldStepNumberById,
} from '~/lib/workspace-forms/form-steps';
import {
  type WorkspaceFormLayout,
  type WorkspaceFormPageBackground,
  type WorkspaceFormPresentation,
  isRsvpLikeWorkspaceForm,
} from '~/lib/workspace-forms/form-theme';
import type { WorkspaceFormsMode } from '~/lib/workspace-forms/forms-mode';
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
  WorkspaceFormSubmissionRecord,
} from '../_lib/server/workspace-forms.service';
import { FormAppearancePanel } from './form-appearance-panel';
import { FormEmailSettingsPanel } from './form-email-settings-panel';
import { FormFieldTypePicker } from './form-field-type-picker';
import { FormQuestionCard } from './form-question-card';
import { FormSharePanel } from './form-share-panel';
import { FormSubmissionsList } from './form-submissions-list';

const FORM_EDITOR_TABS = [
  { id: 'submissions', label: 'Submissions', icon: Inbox },
  { id: 'builder', label: 'Form builder', icon: ListChecks },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'notifications', label: 'Notifications', icon: Mail },
  { id: 'share', label: 'Share and Embed', icon: Share2 },
] as const satisfies ReadonlyArray<{
  id: FormEditorTab;
  label: string;
  icon: typeof Inbox;
}>;

const formEditorTabTriggerClass = cn(
  'gap-1.5 rounded-lg px-3 py-2 text-sm',
  'data-[state=active]:bg-[var(--workspace-shell-panel)]',
  'data-[state=active]:text-[var(--workspace-shell-text)]',
  'data-[state=active]:shadow-sm',
);

type Props = {
  accountSlug: string;
  form: WorkspaceFormRecord;
  listings: ListingOption[];
  audienceLists: CampaignAudienceList[];
  members: FormNotifyMemberOption[];
  submissions: WorkspaceFormSubmissionRecord[];
  showListingDestination: boolean;
  formsMode: WorkspaceFormsMode;
  brandColors: { primary: string; accent: string };
  initialTab?: FormEditorTab;
};

export function FormBuilder({
  accountSlug,
  form,
  listings,
  audienceLists,
  members,
  submissions,
  showListingDestination,
  formsMode,
  brandColors,
  initialTab,
}: Props) {
  const audienceOnly = formsMode === 'audience';
  const fullForms = formsMode === 'full';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseFormEditorTab(searchParams.get('tab') ?? initialTab);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? '');
  const [eventAddress, setEventAddress] = useState(form.eventAddress ?? '');
  const [eventDate, setEventDate] = useState(form.eventDate ?? '');
  const [eventTime, setEventTime] = useState(form.eventTime ?? '');
  const [destination, setDestination] = useState(form.destination);
  const [listingId, setListingId] = useState(form.listingId ?? '');
  const [audienceListIds, setAudienceListIds] = useState<string[]>(
    form.audienceListIds?.length
      ? form.audienceListIds
      : form.audienceListId
        ? [form.audienceListId]
        : [],
  );
  const [submitLabel, setSubmitLabel] = useState(form.submitLabel);
  const [successMessage, setSuccessMessage] = useState(
    form.successMessage ?? '',
  );
  const [fields, setFields] = useState(form.fields);
  const [enabled, setEnabled] = useState(form.enabled);
  const [pageBackground, setPageBackground] =
    useState<WorkspaceFormPageBackground>(form.theme.pageBackground);
  const [layout, setLayout] = useState<WorkspaceFormLayout>(form.theme.layout);
  const [presentation, setPresentation] = useState<WorkspaceFormPresentation>(
    audienceOnly ? 'classic' : form.theme.presentation,
  );
  const [primaryColor, setPrimaryColor] = useState<string | null>(
    form.theme.primaryColor,
  );
  const [accentColor, setAccentColor] = useState<string | null>(
    form.theme.accentColor,
  );
  const [emailSettings, setEmailSettings] =
    useState<WorkspaceFormEmailSettings>(form.emailSettings);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(
    form.fields[0]?.id ?? null,
  );
  const visibleStepById = visibleFieldStepNumberById(fields);
  const visibleFields = publicVisibleFields(fields);
  const lastVisibleId = visibleFields.at(-1)?.id ?? null;

  function setTab(next: string) {
    const resolved = parseFormEditorTab(next);
    if (resolved === tab) return;
    router.replace(formEditorTabHref(pathname, resolved, searchParams), {
      scroll: false,
    });
  }

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
          eventAddress: eventAddress.trim() || null,
          eventDate: eventDate.trim() || null,
          eventTime: eventTime.trim() || null,
          destination,
          listingId: listingId || null,
          audienceListId: audienceListIds[0] ?? null,
          audienceListIds,
          submitLabel: submitLabel.trim() || 'Submit',
          successMessage: successMessage.trim() || null,
          fields,
          enabled,
          theme: {
            pageBackground,
            layout,
            layoutExplicit: true,
            presentation: audienceOnly ? 'classic' : presentation,
            primaryColor,
            accentColor,
          },
          emailSettings,
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
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <TabsList
          className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-[var(--workspace-control-surface)] p-1 text-[var(--workspace-shell-text-muted)]"
          data-test="form-editor-tabs"
        >
          {FORM_EDITOR_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className={formEditorTabTriggerClass}
                data-test={`form-editor-tab-${item.id}`}
              >
                <Icon className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                {item.label}
                {item.id === 'submissions' && submissions.length > 0 ? (
                  <span className="rounded-md bg-[var(--workspace-shell-panel)] px-1.5 py-0.5 text-[10px] font-semibold">
                    {submissions.length}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="submissions" className="mt-0">
          <FormSubmissionsList
            accountId={form.accountId}
            accountSlug={accountSlug}
            formId={form.id}
            formName={name}
            fields={fields}
            submissions={submissions}
            destination={destination}
            isRsvp={isRsvpLikeWorkspaceForm({
              eventAddress: eventAddress.trim() || null,
              eventDate: eventDate.trim() || null,
              eventTime: eventTime.trim() || null,
              destination,
              submitLabel,
              name,
              fields,
            })}
          />
        </TabsContent>

        <TabsContent value="builder" className="mt-0 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="grid gap-0.5">
              <h2 className={`text-base font-semibold ${workspaceText}`}>
                Questions
              </h2>
              {fullForms && presentation === 'steps' ? (
                <p className={`text-xs ${workspaceTextMuted}`}>
                  New questions start on their own step. Use “Keep next question
                  on this step” to show more than one field at a time.
                </p>
              ) : null}
            </div>
            <FormFieldTypePicker
              placeholder="Add question"
              testId="add-form-field"
              formsMode={formsMode}
              onSelect={(type) => {
                setFields((current) => {
                  const next = createWorkspaceFormField(type, current);
                  setActiveFieldId(next.id);
                  return [...current, next];
                });
              }}
            />
          </div>

          {fields.map((field, index) => (
            <FormQuestionCard
              key={field.id}
              field={field}
              index={index}
              total={fields.length}
              active={activeFieldId === field.id}
              stepIndex={
                fullForms && presentation === 'steps'
                  ? (visibleStepById.get(field.id) ?? null)
                  : null
              }
              logicEnabled={fullForms}
              formsMode={formsMode}
              stepAction={
                fullForms &&
                presentation === 'steps' &&
                field.type !== 'hidden' &&
                field.id !== lastVisibleId
                  ? fieldHasStepBreakAfter(field)
                    ? {
                        kind: 'merge',
                        onClick: () =>
                          setFields((current) =>
                            setFieldStepBreakAfter(current, field.id, false),
                          ),
                      }
                    : {
                        kind: 'split',
                        onClick: () =>
                          setFields((current) =>
                            setFieldStepBreakAfter(current, field.id, true),
                          ),
                      }
                  : null
              }
              priorFields={fields
                .slice(0, index)
                .filter((item) => item.type !== 'hidden')}
              laterFields={fields
                .slice(index + 1)
                .filter((item) => item.type !== 'hidden')}
              onActivate={() => setActiveFieldId(field.id)}
              onChange={(patch) => updateField(field.id, patch)}
              onChangeType={(type) =>
                updateField(field.id, applyWorkspaceFormFieldType(field, type))
              }
              onMove={(direction) => moveField(field.id, direction)}
              onDuplicate={() =>
                setFields((current) => {
                  const copy = duplicateWorkspaceFormField(field, current);
                  setActiveFieldId(copy.id);
                  const at = current.findIndex((item) => item.id === field.id);
                  const next = [...current];
                  next.splice(at + 1, 0, copy);
                  return next;
                })
              }
              onRemove={() =>
                setFields((current) =>
                  current.filter((item) => item.id !== field.id),
                )
              }
            />
          ))}

          <button
            type="button"
            className={`${workspacePanelCard} flex w-full items-center justify-center gap-2 px-4 py-3 text-sm ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
            onClick={() =>
              setFields((current) => {
                const next = createWorkspaceFormField('text', current);
                setActiveFieldId(next.id);
                return [...current, next];
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add question
          </button>
        </TabsContent>

        <TabsContent value="settings" className="mt-0 space-y-4">
          <section className={`${workspacePanelCard} space-y-4 p-5`}>
            <div className="grid gap-1.5">
              <Label htmlFor="form-name">Form / event name</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-test="form-name-input"
                className="font-heading h-11 text-lg font-semibold"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Intro</Label>
              <WorkspaceRichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the event or form. Paragraphs, lists, and links are supported."
                minHeight={110}
              />
            </div>

            {fullForms ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="event-address">Event address</Label>
                  <Input
                    id="event-address"
                    value={eventAddress}
                    onChange={(event) => setEventAddress(event.target.value)}
                    placeholder="Shown on the public RSVP page — not a submitter question"
                    data-test="form-event-address"
                  />
                  <p className={`text-xs ${workspaceTextMuted}`}>
                    Optional venue line for event / RSVP pages. Submitters do
                    not fill this in.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="event-date">Event date</Label>
                    <Input
                      id="event-date"
                      value={eventDate}
                      onChange={(event) => setEventDate(event.target.value)}
                      placeholder="15 October"
                      data-test="form-event-date"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="event-time">Event time</Label>
                    <Input
                      id="event-time"
                      value={eventTime}
                      onChange={(event) => setEventTime(event.target.value)}
                      placeholder="8:00am – 10:00am"
                      data-test="form-event-time"
                    />
                  </div>
                </div>
                <p className={`-mt-2 text-xs ${workspaceTextMuted}`}>
                  Optional. Shown with icons on the public page when filled in —
                  same as the event address, not a submitter question.
                </p>
              </>
            ) : null}
          </section>

          <section className={`${workspacePanelCard} space-y-4 p-5`}>
            <h2 className={`text-base font-semibold ${workspaceText}`}>
              Collection
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Destination</Label>
                {audienceOnly ? (
                  <p
                    className={`rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-sm ${workspaceText}`}
                    data-test="form-destination"
                  >
                    {WORKSPACE_FORM_DESTINATION_LABELS[destination]}
                  </p>
                ) : (
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
                      } else {
                        setAudienceListIds([]);
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
                      {showListingDestination ||
                      destination === 'listing_enquiry' ? (
                        <SelectItem value="listing_enquiry">
                          {WORKSPACE_FORM_DESTINATION_LABELS.listing_enquiry}
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="submit-label">Submit button</Label>
                <Input
                  id="submit-label"
                  value={submitLabel}
                  onChange={(event) => setSubmitLabel(event.target.value)}
                />
              </div>
            </div>

            {destination === 'mailing_list' ? (
              <div className="grid gap-1.5">
                <Label>Add subscribers to audience lists</Label>
                {audienceLists.length === 0 ? (
                  <p
                    className={`text-sm ${workspaceTextMuted}`}
                    data-test="form-audience-lists-empty"
                  >
                    No audience lists yet. Create one in Campaigns → Audiences.
                  </p>
                ) : (
                  <div
                    className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-3"
                    data-test="form-audience-lists"
                  >
                    {audienceLists.map((list) => {
                      const id = `form-audience-list-${list.id}`;
                      return (
                        <label
                          key={list.id}
                          htmlFor={id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            id={id}
                            checked={audienceListIds.includes(list.id)}
                            onCheckedChange={(value) => {
                              setAudienceListIds((current) =>
                                value === true
                                  ? [...new Set([...current, list.id])]
                                  : current.filter((item) => item !== list.id),
                              );
                            }}
                          />
                          <span className="min-w-0">
                            <span className={`block ${workspaceText}`}>
                              {list.name}
                            </span>
                            {list.isPublic ? (
                              <span
                                className={`block text-xs ${workspaceTextMuted}`}
                              >
                                Public — subscribers can pick this list
                              </span>
                            ) : (
                              <span
                                className={`block text-xs ${workspaceTextMuted}`}
                              >
                                Private — auto-joined, hidden on the form
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Optional. One list auto-joins on submit. Several lists: public
                  ones can be offered as an optional picker; private lists
                  always join. Manual lists get this person as a member.
                </p>
              </div>
            ) : null}

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

            <div className="grid gap-1.5">
              <Label htmlFor="success-message">Success message</Label>
              <Input
                id="success-message"
                value={successMessage}
                onChange={(event) => setSuccessMessage(event.target.value)}
                placeholder="Thank you — we have received your enquiry."
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <FormEmailSettingsPanel
            settings={emailSettings}
            fields={fields}
            members={members}
            onChange={setEmailSettings}
          />
        </TabsContent>

        <TabsContent value="share" className="mt-0 space-y-4">
          <FormAppearancePanel
            formsMode={formsMode}
            brandColors={brandColors}
            pageBackground={pageBackground}
            layout={layout}
            presentation={presentation}
            primaryColor={primaryColor}
            accentColor={accentColor}
            onPageBackground={setPageBackground}
            onLayout={setLayout}
            onPresentation={setPresentation}
            onPrimaryColor={setPrimaryColor}
            onAccentColor={setAccentColor}
          />
          <FormSharePanel
            shareToken={form.shareToken}
            enabled={enabled}
            destination={destination}
            listingId={listingId || null}
            pending={pending}
            onToggle={togglePublished}
            showPropertyHiveSnippet={showListingDestination}
          />
        </TabsContent>
      </Tabs>

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
