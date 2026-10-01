'use client';

import { useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

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

import {
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  type DisposalsExportOptions,
  DisposalsExportOptionsSchema,
  EXPORT_COLUMN_META,
  EXPORT_GROUP_BY,
  EXPORT_GROUP_BY_LABELS,
  EXPORT_GROUP_ORDER,
  EXPORT_NO_OFFICE,
  EXPORT_SORT_BY,
  EXPORT_SORT_BY_LABELS,
} from '~/lib/commercial/disposals-export';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

export type ExportOffice = { id: string; name: string };

const COLUMN_LABEL = new Map(
  EXPORT_COLUMN_META.map((column) => [column.id, column.label]),
);

const STATUS_HINTS: Partial<Record<ListingStatus, string>> = {
  marketing: 'On the market',
};

export const exportSectionTitle =
  'text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase';
const sectionTitle = exportSectionTitle;

const iconButton =
  'flex h-5 w-5 items-center justify-center rounded text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)] disabled:opacity-30';

/** Drops columns and offices that no longer exist; null if nothing usable is left. */
export function cleanExportOptions(
  value: unknown,
  officeIds: Set<string>,
): DisposalsExportOptions | null {
  const parsed = DisposalsExportOptionsSchema.safeParse(value);
  if (!parsed.success) return null;
  const columns = parsed.data.columns.filter((id) => COLUMN_LABEL.has(id));
  if (columns.length === 0) return null;
  return {
    ...parsed.data,
    columns,
    officeIds: parsed.data.officeIds.filter(
      (id) => id === EXPORT_NO_OFFICE || officeIds.has(id),
    ),
  };
}

/**
 * The column, office, status, group and sort pickers, shared by the export
 * dialog and the scheduled report editor.
 */
export function DisposalsExportFields({
  options,
  offices,
  onChange,
  extra,
}: {
  options: DisposalsExportOptions;
  offices: ExportOffice[];
  onChange: (next: DisposalsExportOptions) => void;
  /** Extra sections rendered after the sort controls. */
  extra?: React.ReactNode;
}) {
  const [search, setSearch] = useState('');

  const update = (patch: Partial<DisposalsExportOptions>) =>
    onChange({ ...options, ...patch });

  const toggleColumn = (id: string, on: boolean) =>
    update({
      columns: on
        ? [...options.columns, id]
        : options.columns.filter((column) => column !== id),
    });

  const moveColumn = (index: number, by: -1 | 1) => {
    const next = [...options.columns];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    update({ columns: next });
  };

  const toggleOffice = (id: string, on: boolean) =>
    update({
      officeIds: on
        ? [...options.officeIds, id]
        : options.officeIds.filter((officeId) => officeId !== id),
    });

  const toggleStatus = (status: ListingStatus, on: boolean) =>
    update({
      statuses: on
        ? [...options.statuses, status]
        : options.statuses.filter((item) => item !== status),
    });

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = EXPORT_COLUMN_META.filter(
      (column) => !query || column.label.toLowerCase().includes(query),
    );
    return EXPORT_GROUP_ORDER.map((group) => ({
      group,
      columns: matching.filter((column) => column.group === group),
    })).filter((entry) => entry.columns.length > 0);
  }, [search]);

  const allOffices = options.officeIds.length === 0;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className={sectionTitle}>Columns</h3>
        {options.columns.length === 0 ? (
          <p className="text-sm text-rose-500">Pick at least one column.</p>
        ) : (
          <ol
            className="flex flex-wrap gap-1.5"
            aria-label="Selected columns, in the order they will appear"
          >
            {options.columns.map((id, index) => (
              <li
                key={id}
                className="flex items-center gap-0.5 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] py-0.5 pr-1 pl-1.5 text-xs font-medium text-[var(--workspace-shell-text)]"
              >
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  aria-label={`Move ${COLUMN_LABEL.get(id)} earlier`}
                  onClick={() => moveColumn(index, -1)}
                >
                  <ChevronLeft aria-hidden className="h-3 w-3" />
                </button>
                <span className="px-0.5">{COLUMN_LABEL.get(id)}</span>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === options.columns.length - 1}
                  aria-label={`Move ${COLUMN_LABEL.get(id)} later`}
                  onClick={() => moveColumn(index, 1)}
                >
                  <ChevronRight aria-hidden className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Remove ${COLUMN_LABEL.get(id)}`}
                  onClick={() => toggleColumn(id, false)}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>
        )}

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search for more columns…"
          aria-label="Search columns"
          className="h-9"
        />
        <div
          // Re-mount when searching starts or stops so the groups re-open.
          key={search.trim() ? 'searching' : 'browsing'}
          className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-2"
        >
          {groups.length === 0 ? (
            <p className="p-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No columns match.
            </p>
          ) : null}
          {groups.map(({ group, columns }) => (
            <details
              key={group}
              open={Boolean(search.trim()) || group === 'At a glance'}
              className="group"
            >
              <summary className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]">
                {group}
                <span className="ml-2 text-xs font-normal text-[var(--workspace-shell-text-muted)]">
                  {columns.filter((c) => options.columns.includes(c.id)).length}
                  /{columns.length}
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 px-2 py-1.5 sm:grid-cols-2">
                {columns.map((column) => {
                  const inputId = `export-col-${column.id}`;
                  return (
                    <div key={column.id} className="flex items-center gap-2">
                      <Checkbox
                        id={inputId}
                        checked={options.columns.includes(column.id)}
                        onCheckedChange={(checked) =>
                          toggleColumn(column.id, checked === true)
                        }
                      />
                      <Label
                        htmlFor={inputId}
                        className="cursor-pointer text-sm font-normal text-[var(--workspace-shell-text)]"
                      >
                        {column.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Add the “Updates” column for a blank space to write notes on a
          printout.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        {offices.length > 0 ? (
          <section className="space-y-2">
            <h3 className={sectionTitle}>Offices</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="export-office-all"
                  checked={allOffices}
                  onCheckedChange={() => update({ officeIds: [] })}
                />
                <Label
                  htmlFor="export-office-all"
                  className="cursor-pointer text-sm font-normal text-[var(--workspace-shell-text)]"
                >
                  All offices
                </Label>
              </div>
              {[
                ...offices,
                { id: EXPORT_NO_OFFICE, name: 'No office assigned' },
              ].map((office) => (
                <div key={office.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`export-office-${office.id}`}
                    checked={options.officeIds.includes(office.id)}
                    onCheckedChange={(checked) =>
                      toggleOffice(office.id, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`export-office-${office.id}`}
                    className="cursor-pointer text-sm font-normal text-[var(--workspace-shell-text)]"
                  >
                    {office.name}
                  </Label>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className={sectionTitle}>Include disposals that are</h3>
          <div className="space-y-1.5">
            {LISTING_STATUSES.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <Checkbox
                  id={`export-status-${status}`}
                  checked={options.statuses.includes(status)}
                  onCheckedChange={(checked) =>
                    toggleStatus(status, checked === true)
                  }
                />
                <Label
                  htmlFor={`export-status-${status}`}
                  className="cursor-pointer text-sm font-normal text-[var(--workspace-shell-text)]"
                >
                  {LISTING_STATUS_LABELS[status]}
                  {STATUS_HINTS[status] ? (
                    <span className="ml-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                      {STATUS_HINTS[status]}
                    </span>
                  ) : null}
                </Label>
              </div>
            ))}
          </div>
          {options.statuses.length === 0 ? (
            <p className="text-sm text-rose-500">Pick at least one.</p>
          ) : null}
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={sectionTitle}>Group by</Label>
          <Select
            value={options.groupBy}
            onValueChange={(value) =>
              update({
                groupBy: value as DisposalsExportOptions['groupBy'],
              })
            }
          >
            <SelectTrigger aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              {EXPORT_GROUP_BY.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className={workspaceSelectItemClass}
                >
                  {EXPORT_GROUP_BY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className={sectionTitle}>Sort by</Label>
          <Select
            value={options.sortBy}
            onValueChange={(value) =>
              update({ sortBy: value as DisposalsExportOptions['sortBy'] })
            }
          >
            <SelectTrigger aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              {EXPORT_SORT_BY.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                  className={workspaceSelectItemClass}
                >
                  {EXPORT_SORT_BY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)] sm:col-span-2">
          Grouping shows as headings on the printout and PDF. Excel and CSV stay
          as one filterable list, in the same order.
        </p>
      </section>
      {extra}
    </div>
  );
}
