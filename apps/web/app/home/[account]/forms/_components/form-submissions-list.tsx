'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';

import Link from 'next/link';

import { Columns3, Download, Mail } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  type SubmissionColumnId,
  countRsvpAttendeeTotals,
  countSubmissionStats,
  defaultSubmissionColumnIds,
  groupSubmissionIdsByEmail,
  listFilledSubmissionAnswers,
  listSubmissionColumnOptions,
  normalizeSubmissionEmail,
  parseStoredSubmissionColumns,
  submissionBuiltinValue,
  submissionColumnStorageKey,
  submissionFieldValue,
  submissionRecordLabel,
} from '~/lib/workspace-forms/form-submissions-view';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { WorkspaceFormSubmissionRecord } from '../_lib/server/workspace-forms.service';
import { FormSubmissionsExportDialog } from './form-submissions-export-dialog';

type Props = {
  accountSlug: string;
  formId: string;
  formName: string;
  fields: WorkspaceFormField[];
  submissions: WorkspaceFormSubmissionRecord[];
  destination?: string;
  isRsvp?: boolean;
};

function recordHref(
  accountSlug: string,
  submission: WorkspaceFormSubmissionRecord,
) {
  if (submission.commercialEnquiryId && submission.listingId) {
    return `${pathsConfig.app.accountListingDetail
      .replace('[account]', accountSlug)
      .replace('[id]', submission.listingId)}/interest`;
  }

  if (submission.clientId) {
    return pathsConfig.app.accountClientDetail
      .replace('[account]', accountSlug)
      .replace('[clientId]', submission.clientId);
  }

  if (submission.requirementId) {
    return pathsConfig.app.accountRequirements.replace(
      '[account]',
      accountSlug,
    );
  }

  if (submission.pipelineDealId) {
    return pathsConfig.app.accountPipeline.replace('[account]', accountSlug);
  }

  return null;
}

function formatReceivedAt(iso: string) {
  return new Date(iso).toLocaleString('en-GB');
}

const columnPrefListeners = new Set<() => void>();

function subscribeColumnPrefs(listener: () => void) {
  columnPrefListeners.add(listener);
  return () => {
    columnPrefListeners.delete(listener);
  };
}

function emitColumnPrefs() {
  for (const listener of columnPrefListeners) listener();
}

function getColumnPrefsSnapshot(formId: string) {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(submissionColumnStorageKey(formId)) ?? '';
}

function useSubmissionColumns(formId: string, fields: WorkspaceFormField[]) {
  const options = useMemo(() => listSubmissionColumnOptions(fields), [fields]);
  const allowed = useMemo(
    () => new Set(options.map((option) => option.id)),
    [options],
  );
  const defaults = useMemo(() => defaultSubmissionColumnIds(fields), [fields]);
  const raw = useSyncExternalStore(
    subscribeColumnPrefs,
    () => getColumnPrefsSnapshot(formId),
    () => '',
  );
  const columns = parseStoredSubmissionColumns(raw, allowed) ?? defaults;

  function saveColumns(next: SubmissionColumnId[]) {
    const sanitized = next.filter((id) => allowed.has(id));
    const resolved = sanitized.length > 0 ? sanitized : defaults;
    window.localStorage.setItem(
      submissionColumnStorageKey(formId),
      JSON.stringify(resolved),
    );
    emitColumnPrefs();
  }

  return { options, columns, saveColumns, defaults };
}

export function FormSubmissionsList({
  accountSlug,
  formId,
  formName,
  fields,
  submissions,
  destination,
  isRsvp = false,
}: Props) {
  const submissionsOnly = destination === 'submission_list';
  const fieldByKey = useMemo(
    () => new Map(fields.map((field) => [field.key, field])),
    [fields],
  );
  const emailGroups = useMemo(
    () => groupSubmissionIdsByEmail(submissions),
    [submissions],
  );
  const stats = useMemo(() => countSubmissionStats(submissions), [submissions]);
  const attendeeTotals = useMemo(
    () => countRsvpAttendeeTotals(fields, submissions),
    [fields, submissions],
  );
  const { options, columns, saveColumns, defaults } = useSubmissionColumns(
    formId,
    fields,
  );
  const [emailFilter, setEmailFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const visibleSubmissions = useMemo(() => {
    if (!emailFilter) return submissions;
    return submissions.filter(
      (submission) =>
        normalizeSubmissionEmail(submission.contactEmail) === emailFilter,
    );
  }, [emailFilter, submissions]);

  const openSubmission =
    submissions.find((submission) => submission.id === openId) ?? null;
  const openEmail = openSubmission
    ? normalizeSubmissionEmail(openSubmission.contactEmail)
    : null;
  const relatedIds =
    openSubmission && openEmail
      ? (emailGroups.get(openEmail) ?? []).filter(
          (id) => id !== openSubmission.id,
        )
      : [];

  return (
    <section className={`${workspacePanelCard} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${workspaceText}`}>
            Submissions
          </h2>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            {submissionsOnly
              ? 'Responses are stored here only — no pipeline, mailing list, or listing enquiry is created.'
              : 'Open the contact, mailing-list, pipeline, or listing record created from each submission.'}
          </p>
        </div>
        {submissions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExportOpen(true)}
              data-test="export-submissions"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <ColumnPicker
              options={options}
              columns={columns}
              defaults={defaults}
              onChange={saveColumns}
            />
          </div>
        ) : null}
      </div>

      {isRsvp ? (
        <div className="mt-4 grid gap-3" data-test="form-submissions-stats">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total submissions" value={stats.total} />
            <StatCard
              label="Unique submissions"
              value={stats.unique}
              hint="Unique by email when present"
            />
          </div>
          {attendeeTotals ? (
            <div
              className="grid gap-3 sm:grid-cols-3"
              data-test="form-submissions-attendee-stats"
            >
              <StatCard
                label="Total attendees"
                value={attendeeTotals.totalAttendees}
                hint="Yes RSVPs plus their guests"
              />
              <StatCard
                label="Invitees"
                value={attendeeTotals.invitees}
                hint="Said yes · latest RSVP per email"
              />
              <StatCard
                label="Guests"
                value={attendeeTotals.guests}
                hint="Sum of guest counts on Yes RSVPs"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {submissions.length === 0 ? (
        <p className={`mt-6 text-sm ${workspaceTextMuted}`}>
          {submissionsOnly
            ? 'No submissions yet. Publish the form and share the link to start collecting RSVPs or responses.'
            : 'No submissions yet. Publish the form and send the public link to collect the first one.'}
        </p>
      ) : (
        <>
          {emailFilter ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">
                {visibleSubmissions.length} from {emailFilter}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEmailFilter(null)}
                data-test="clear-email-filter"
              >
                Show all
              </Button>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className={workspaceTextMuted}>
                  {columns.map((column) => (
                    <th key={column} className="pr-4 pb-2 font-medium">
                      {options.find((option) => option.id === column)?.label ??
                        column}
                    </th>
                  ))}
                  <th className="pb-2 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSubmissions.map((submission) => {
                  const email = normalizeSubmissionEmail(
                    submission.contactEmail,
                  );
                  const relatedCount = email
                    ? (emailGroups.get(email)?.length ?? 1) - 1
                    : 0;

                  return (
                    <tr
                      key={submission.id}
                      className="border-t border-[color:var(--workspace-shell-border)]"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className={cn('py-3 pr-4', workspaceText)}
                        >
                          <SubmissionCell
                            column={column}
                            submission={submission}
                            field={
                              column.startsWith('field:')
                                ? fieldByKey.get(column.slice(6))
                                : undefined
                            }
                            accountSlug={accountSlug}
                            submissionsOnly={submissionsOnly}
                            relatedCount={relatedCount}
                            showRelatedChip={
                              column === 'email' ||
                              (column === 'name' && !columns.includes('email'))
                            }
                            onFilterEmail={setEmailFilter}
                          />
                        </td>
                      ))}
                      <td className="py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setOpenId(submission.id)}
                          data-test={`open-submission-${submission.id}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FormSubmissionsExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        formName={formName}
        fields={fields}
        submissions={submissions}
        tableColumns={columns}
        submissionsOnly={submissionsOnly}
      />

      <SubmissionDetailDialog
        accountSlug={accountSlug}
        fields={fields}
        submission={openSubmission}
        submissionsOnly={submissionsOnly}
        relatedIds={relatedIds}
        submissions={submissions}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onOpenRelated={setOpenId}
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-4 py-3">
      <p className={`text-xs font-medium ${workspaceTextMuted}`}>{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${workspaceText}`}>{value}</p>
      {hint ? (
        <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>{hint}</p>
      ) : null}
    </div>
  );
}

function ColumnPicker({
  options,
  columns,
  defaults,
  onChange,
}: {
  options: ReturnType<typeof listSubmissionColumnOptions>;
  columns: SubmissionColumnId[];
  defaults: SubmissionColumnId[];
  onChange: (next: SubmissionColumnId[]) => void;
}) {
  function toggle(id: SubmissionColumnId, checked: boolean) {
    if (checked) {
      if (columns.includes(id)) return;
      onChange([...columns, id]);
      return;
    }
    onChange(columns.filter((column) => column !== id));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-test="edit-submission-columns"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Edit columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className={`mb-2 text-sm font-medium ${workspaceText}`}>
          Table columns
        </p>
        <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1">
          {options.map((option) => {
            const checked = columns.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggle(option.id, value === true)}
                />
                <span className={workspaceText}>{option.label}</span>
              </label>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => onChange(defaults)}
        >
          Reset to default
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SubmissionCell({
  column,
  submission,
  field,
  accountSlug,
  submissionsOnly,
  relatedCount,
  showRelatedChip,
  onFilterEmail,
}: {
  column: SubmissionColumnId;
  submission: WorkspaceFormSubmissionRecord;
  field?: WorkspaceFormField;
  accountSlug: string;
  submissionsOnly: boolean;
  relatedCount: number;
  showRelatedChip: boolean;
  onFilterEmail: (email: string) => void;
}) {
  if (column === 'received') {
    return (
      <span className={workspaceTextMuted}>
        {formatReceivedAt(submission.createdAt)}
      </span>
    );
  }

  if (column === 'record') {
    const href = recordHref(accountSlug, submission);
    const label = submissionRecordLabel(submission, submissionsOnly);
    return href ? (
      <Link
        href={href}
        className="text-[var(--workspace-shell-accent-text)] underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    ) : (
      <Badge variant="secondary">{label}</Badge>
    );
  }

  if (column === 'email' || column === 'name') {
    const email = submissionBuiltinValue(submission, 'email');
    const normalized = normalizeSubmissionEmail(email);
    const primary =
      column === 'email'
        ? email || '—'
        : submissionBuiltinValue(submission, 'name') || '—';

    if (column === 'email' && !normalized) {
      return <span className={workspaceTextMuted}>—</span>;
    }

    return (
      <div className="grid gap-1">
        {column === 'email' && normalized ? (
          <button
            type="button"
            className="text-left text-[var(--workspace-shell-accent-text)] underline-offset-4 hover:underline"
            onClick={() => onFilterEmail(normalized)}
            data-test="filter-same-email"
          >
            {primary}
          </button>
        ) : (
          <span className="max-w-[14rem] truncate">{primary}</span>
        )}
        {showRelatedChip && relatedCount > 0 && normalized ? (
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-xs ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
            onClick={() => onFilterEmail(normalized)}
            data-test="same-email-chip"
          >
            <Mail className="h-3 w-3" />
            {relatedCount} other{relatedCount === 1 ? '' : 's'} from this email
          </button>
        ) : null}
      </div>
    );
  }

  if (column === 'phone') {
    return (
      <span className="max-w-[14rem] truncate">
        {submissionBuiltinValue(submission, column) || '—'}
      </span>
    );
  }

  if (field) {
    const value = submissionFieldValue(submission, field);
    return (
      <span className="block max-w-[16rem] truncate" title={value || undefined}>
        {value || '—'}
      </span>
    );
  }

  return <span className={workspaceTextMuted}>—</span>;
}

function SubmissionDetailDialog({
  accountSlug,
  fields,
  submission,
  submissionsOnly,
  relatedIds,
  submissions,
  onOpenChange,
  onOpenRelated,
}: {
  accountSlug: string;
  fields: WorkspaceFormField[];
  submission: WorkspaceFormSubmissionRecord | null;
  submissionsOnly: boolean;
  relatedIds: string[];
  submissions: WorkspaceFormSubmissionRecord[];
  onOpenChange: (open: boolean) => void;
  onOpenRelated: (id: string) => void;
}) {
  const answers = submission
    ? listFilledSubmissionAnswers(fields, submission)
    : [];
  const href = submission ? recordHref(accountSlug, submission) : null;
  const related = relatedIds
    .map((id) => submissions.find((item) => item.id === id))
    .filter((item): item is WorkspaceFormSubmissionRecord => Boolean(item));

  return (
    <Dialog open={Boolean(submission)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-lg overflow-y-auto"
        data-test="submission-detail-dialog"
      >
        {submission ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {submissionBuiltinValue(submission, 'name') || 'Submission'}
              </DialogTitle>
              <DialogDescription>
                Received {formatReceivedAt(submission.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 text-sm">
              <DetailRow
                label="Email"
                value={submissionBuiltinValue(submission, 'email') || '—'}
              />
              <DetailRow
                label="Phone"
                value={submissionBuiltinValue(submission, 'phone') || '—'}
              />
              <div>
                <dt className={workspaceTextMuted}>Record</dt>
                <dd className={`mt-0.5 ${workspaceText}`}>
                  {href ? (
                    <Link
                      href={href}
                      className="text-[var(--workspace-shell-accent-text)] underline-offset-4 hover:underline"
                    >
                      {submissionRecordLabel(submission, submissionsOnly)}
                    </Link>
                  ) : (
                    submissionRecordLabel(submission, submissionsOnly)
                  )}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className={`text-sm font-semibold ${workspaceText}`}>
                Answers
              </h3>
              {answers.length === 0 ? (
                <p className={`mt-2 text-sm ${workspaceTextMuted}`}>
                  No filled fields on this submission.
                </p>
              ) : (
                <dl className="mt-2 grid gap-3 text-sm">
                  {answers.map((answer) => (
                    <DetailRow
                      key={answer.key}
                      label={answer.label}
                      value={answer.value}
                    />
                  ))}
                </dl>
              )}
            </div>

            {related.length > 0 ? (
              <div>
                <h3 className={`text-sm font-semibold ${workspaceText}`}>
                  Other submissions from this email
                </h3>
                <ul className="mt-2 grid gap-1">
                  {related.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="text-sm text-[var(--workspace-shell-accent-text)] underline-offset-4 hover:underline"
                        onClick={() => onOpenRelated(item.id)}
                      >
                        {formatReceivedAt(item.createdAt)}
                        {submissionBuiltinValue(item, 'name')
                          ? ` · ${submissionBuiltinValue(item, 'name')}`
                          : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={workspaceTextMuted}>{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-line ${workspaceText}`}>{value}</dd>
    </div>
  );
}
