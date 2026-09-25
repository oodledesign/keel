'use client';

import { type KeyboardEvent, useMemo, useState, useTransition } from 'react';

import { Bell, Link2, Plus, Radar, Trash2, Upload } from 'lucide-react';

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

import {
  COMPETITOR_CATEGORIES,
  COMPETITOR_CATEGORY_LABELS,
  COMPETITOR_STATUSES,
  COMPETITOR_STATUS_LABELS,
  COMPETITOR_TENURES,
  COMPETITOR_TENURE_LABELS,
  type CompetitorCategory,
  type CompetitorStatus,
  type CompetitorTenure,
  formatCompetitorPricePence,
  parsePriceToPence,
} from '~/lib/commercial/competitor-tracker/constants';
import type {
  CompetitorAreaWatch,
  CompetitorListing,
  CompetitorUrlEnrichment,
  CompetitorWatchNotification,
} from '~/lib/commercial/competitor-tracker/types';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  archiveTrackerListing,
  createTrackerListing,
  createTrackerWatch,
  deleteTrackerWatch,
  enrichTrackerUrl,
  importTrackerCsv,
  markTrackerNotificationsRead,
  runTrackerWatchesNow,
  saveEnrichedTrackerListing,
  updateTrackerListing,
  updateTrackerWatch,
} from '../_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  initialListings: CompetitorListing[];
  initialWatches: CompetitorAreaWatch[];
  initialNotifications: CompetitorWatchNotification[];
};

const cellInputClass =
  'h-8 w-full min-w-[6rem] rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--workspace-shell-text)] outline-none transition-colors hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const selectClass =
  'h-8 w-full min-w-[7rem] rounded-md border border-transparent bg-transparent px-1.5 text-sm text-[var(--workspace-shell-text)] outline-none hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const thClass =
  'sticky top-0 z-10 whitespace-nowrap border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-2 text-left text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text)]/55';

const tdClass =
  'border-b border-[color:var(--workspace-shell-border)]/70 px-1.5 py-1 align-middle';

type ListingDraft = {
  name: string;
  locationText: string;
  town: string;
  postcode: string;
  sizeSqft: string;
  priceDisplay: string;
  tenure: CompetitorTenure | '';
  competitorAgent: string;
  category: CompetitorCategory;
  status: CompetitorStatus;
  sourceUrl: string;
  notes: string;
};

const emptyDraft = (): ListingDraft => ({
  name: '',
  locationText: '',
  town: '',
  postcode: '',
  sizeSqft: '',
  priceDisplay: '',
  tenure: '',
  competitorAgent: '',
  category: 'industrial',
  status: 'watching',
  sourceUrl: '',
  notes: '',
});

function listingToDraft(listing: CompetitorListing): ListingDraft {
  return {
    name: listing.name,
    locationText: listing.locationText ?? '',
    town: listing.town ?? '',
    postcode: listing.postcode ?? '',
    sizeSqft:
      listing.sizeSqft != null ? String(Math.round(listing.sizeSqft)) : '',
    priceDisplay: formatCompetitorPricePence(listing.pricePence).replace(
      /£/g,
      '',
    ),
    tenure: listing.tenure ?? '',
    competitorAgent: listing.competitorAgent ?? '',
    category: listing.category,
    status: listing.status,
    sourceUrl: listing.sourceUrl ?? '',
    notes: listing.notes ?? '',
  };
}

function draftToPayload(draft: ListingDraft) {
  const size = draft.sizeSqft.trim()
    ? Number(draft.sizeSqft.replace(/,/g, ''))
    : null;
  return {
    name: draft.name.trim(),
    locationText: draft.locationText.trim() || null,
    town: draft.town.trim() || null,
    postcode: draft.postcode.trim() || null,
    sizeSqft: Number.isFinite(size) ? size : null,
    pricePence: parsePriceToPence(draft.priceDisplay),
    tenure: draft.tenure || null,
    competitorAgent: draft.competitorAgent.trim() || null,
    category: draft.category,
    status: draft.status,
    sourceUrl: draft.sourceUrl.trim() || null,
    notes: draft.notes.trim() || null,
  };
}

function SheetTextCell({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(value);
      setEditing(false);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      value={editing ? draft : value}
      placeholder={placeholder}
      className={`${cellInputClass} ${className ?? ''}`}
      onFocus={() => {
        setDraft(value);
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

export function TrackerWorkspace({
  accountId,
  initialListings,
  initialWatches,
  initialNotifications,
}: Props) {
  const [listings, setListings] = useState(initialListings);
  const [watches, setWatches] = useState(initialWatches);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [pending, startTransition] = useTransition();

  const [listingOpen, setListingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingDraft>(emptyDraft());

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [enrichment, setEnrichment] = useState<CompetitorUrlEnrichment | null>(
    null,
  );

  const [watchOpen, setWatchOpen] = useState(false);
  const [watchName, setWatchName] = useState('Tunbridge Wells');
  const [watchTowns, setWatchTowns] = useState('Tunbridge Wells, Tonbridge');
  const [watchPrefixes, setWatchPrefixes] = useState('TN1, TN2, TN4');
  const [watchCategories, setWatchCategories] = useState<CompetitorCategory[]>([
    ...COMPETITOR_CATEGORIES,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const agent = agentFilter.trim().toLowerCase();
    return listings.filter((row) => {
      if (categoryFilter !== 'all' && row.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (agent && !(row.competitorAgent ?? '').toLowerCase().includes(agent)) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${row.name} ${row.locationText ?? ''} ${row.town ?? ''} ${row.postcode ?? ''} ${row.competitorAgent ?? ''} ${row.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [listings, categoryFilter, statusFilter, query, agentFilter]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const patchListing = (
    listingId: string,
    patch: Partial<CompetitorListing>,
    serverPatch: {
      name?: string;
      locationText?: string | null;
      town?: string | null;
      postcode?: string | null;
      sizeSqft?: number | null;
      pricePence?: number | null;
      tenure?: CompetitorTenure | null;
      competitorAgent?: string | null;
      category?: CompetitorCategory;
      status?: CompetitorStatus;
      notes?: string | null;
    },
  ) => {
    setListings((prev) =>
      prev.map((row) => (row.id === listingId ? { ...row, ...patch } : row)),
    );
    startTransition(async () => {
      try {
        const saved = await updateTrackerListing({
          ...serverPatch,
          listingId,
          accountId,
        });
        setListings((prev) =>
          prev.map((row) => (row.id === listingId ? saved : row)),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update row',
        );
      }
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setListingOpen(true);
  };

  const openEdit = (listing: CompetitorListing) => {
    setEditingId(listing.id);
    setDraft(listingToDraft(listing));
    setListingOpen(true);
  };

  const saveListingDialog = () => {
    const payload = draftToPayload(draft);
    if (!payload.name) {
      toast.error('Property name is required');
      return;
    }
    startTransition(async () => {
      try {
        if (editingId) {
          const saved = await updateTrackerListing({
            listingId: editingId,
            accountId,
            ...payload,
          });
          setListings((prev) =>
            prev.map((row) => (row.id === editingId ? saved : row)),
          );
          toast.success('Listing updated');
        } else {
          const created = await createTrackerListing({
            accountId,
            ...payload,
          });
          setListings((prev) => [created, ...prev]);
          toast.success('Listing added');
        }
        setListingOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save listing',
        );
      }
    });
  };

  const onArchive = (listing: CompetitorListing) => {
    setListings((prev) => prev.filter((row) => row.id !== listing.id));
    startTransition(async () => {
      try {
        await archiveTrackerListing({
          listingId: listing.id,
          accountId,
        });
        toast.success('Archived');
      } catch (error) {
        setListings((prev) => [listing, ...prev]);
        toast.error(
          error instanceof Error ? error.message : 'Could not archive',
        );
      }
    });
  };

  const onImportCsv = () => {
    if (!csvText.trim()) {
      toast.error('Paste CSV content first');
      return;
    }
    startTransition(async () => {
      try {
        const result = await importTrackerCsv({
          accountId,
          csvText,
        });
        toast.success(
          `Imported ${result.created} new, ${result.updated} updated`,
        );
        if (result.errors.length) {
          toast.message(`${result.errors.length} row errors`, {
            description: result.errors.slice(0, 3).join(' · '),
          });
        }
        setCsvOpen(false);
        setCsvText('');
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'CSV import failed',
        );
      }
    });
  };

  const onEnrichUrl = () => {
    if (!urlValue.trim()) {
      toast.error('Paste a listing URL');
      return;
    }
    startTransition(async () => {
      try {
        const result = await enrichTrackerUrl({
          accountId,
          url: urlValue.trim(),
        });
        setEnrichment(result);
        setDraft({
          ...emptyDraft(),
          name: result.name ?? '',
          locationText: result.locationText ?? '',
          postcode: result.postcode ?? '',
          sizeSqft:
            result.sizeSqft != null ? String(Math.round(result.sizeSqft)) : '',
          priceDisplay: formatCompetitorPricePence(result.pricePence).replace(
            /£/g,
            '',
          ),
          tenure: result.tenure ?? '',
          competitorAgent: result.competitorAgent ?? '',
          sourceUrl: result.sourceUrl,
        });
        if (result.warnings.length) {
          toast.message('Review enrichment', {
            description: result.warnings.slice(0, 2).join(' · '),
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not enrich URL',
        );
      }
    });
  };

  const onSaveEnriched = () => {
    const payload = draftToPayload(draft);
    if (!payload.name) {
      toast.error('Property name is required');
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveEnrichedTrackerListing({
          accountId,
          ...payload,
          enrichmentConfidence: enrichment?.confidence ?? null,
        });
        setListings((prev) => {
          const without = prev.filter((row) => row.id !== result.listing.id);
          return [result.listing, ...without];
        });
        toast.success(result.created ? 'Listing added' : 'Listing updated');
        setUrlOpen(false);
        setUrlValue('');
        setEnrichment(null);
        setDraft(emptyDraft());
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save listing',
        );
      }
    });
  };

  const onCreateWatch = () => {
    const towns = watchTowns
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const prefixes = watchPrefixes
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (!watchName.trim()) {
      toast.error('Watch name is required');
      return;
    }
    startTransition(async () => {
      try {
        const watch = await createTrackerWatch({
          accountId,
          name: watchName.trim(),
          towns,
          postcodePrefixes: prefixes,
          categories: watchCategories,
        });
        setWatches((prev) =>
          [...prev, watch].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setWatchOpen(false);
        toast.success('Area watch created');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create watch',
        );
      }
    });
  };

  const onToggleWatch = (watch: CompetitorAreaWatch) => {
    setWatches((prev) =>
      prev.map((row) =>
        row.id === watch.id ? { ...row, enabled: !row.enabled } : row,
      ),
    );
    startTransition(async () => {
      try {
        const saved = await updateTrackerWatch({
          accountId,
          watchId: watch.id,
          enabled: !watch.enabled,
        });
        setWatches((prev) =>
          prev.map((row) => (row.id === watch.id ? saved : row)),
        );
      } catch (error) {
        setWatches((prev) =>
          prev.map((row) => (row.id === watch.id ? watch : row)),
        );
        toast.error(
          error instanceof Error ? error.message : 'Could not update watch',
        );
      }
    });
  };

  const onDeleteWatch = (watch: CompetitorAreaWatch) => {
    setWatches((prev) => prev.filter((row) => row.id !== watch.id));
    startTransition(async () => {
      try {
        await deleteTrackerWatch({ accountId, watchId: watch.id });
        toast.success('Watch removed');
      } catch (error) {
        setWatches((prev) => [...prev, watch]);
        toast.error(
          error instanceof Error ? error.message : 'Could not delete watch',
        );
      }
    });
  };

  const onRunWatches = () => {
    startTransition(async () => {
      try {
        const result = await runTrackerWatchesNow({
          accountId,
          sinceHours: 48,
        });
        toast.success(
          `Checked ${result.watchesProcessed} watches · ${result.notificationsCreated} notifications`,
        );
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Watch run failed',
        );
      }
    });
  };

  const onMarkNotificationsRead = () => {
    startTransition(async () => {
      try {
        await markTrackerNotificationsRead({ accountId });
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            readAt: n.readAt ?? new Date().toISOString(),
          })),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not mark as read',
        );
      }
    });
  };

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={openCreate}
          disabled={pending}
        >
          <Plus className="size-4" />
          Add listing
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setUrlOpen(true)}
          disabled={pending}
        >
          <Link2 className="size-4" />
          Paste URL
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCsvOpen(true)}
          disabled={pending}
        >
          <Upload className="size-4" />
          Import CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setWatchOpen(true)}
          disabled={pending}
        >
          <Radar className="size-4" />
          Area watch
        </Button>
        <div className={`ml-auto text-sm ${workspaceTextMuted}`}>
          {filtered.length} of {listings.length} listings
        </div>
      </div>

      <div className={`${workspacePanelCard} flex flex-wrap gap-2 p-3`}>
        <Input
          placeholder="Search name, location, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter agent"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="max-w-[10rem]"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[10rem]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {COMPETITOR_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {COMPETITOR_CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[10rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COMPETITOR_STATUSES.map((key) => (
              <SelectItem key={key} value={key}>
                {COMPETITOR_STATUS_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(watches.length > 0 || notifications.length > 0) && (
        <div className={`${workspacePanelCard} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Area watches</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRunWatches}
              disabled={pending || watches.length === 0}
            >
              Check now
            </Button>
            {unreadCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onMarkNotificationsRead}
                disabled={pending}
              >
                <Bell className="size-3.5" />
                Mark {unreadCount} read
              </Button>
            )}
          </div>
          {watches.length > 0 && (
            <ul className="space-y-2">
              {watches.map((watch) => (
                <li
                  key={watch.id}
                  className="flex flex-wrap items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={watch.enabled}
                    onCheckedChange={() => onToggleWatch(watch)}
                  />
                  <span className="font-medium">{watch.name}</span>
                  <span className={workspaceTextMuted}>
                    {[...watch.towns, ...watch.postcodePrefixes]
                      .filter(Boolean)
                      .join(' · ') || 'Any location'}
                  </span>
                  <button
                    type="button"
                    className="text-[var(--workspace-shell-text-muted)] hover:text-red-600"
                    onClick={() => onDeleteWatch(watch)}
                    aria-label={`Delete ${watch.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notifications.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {notifications.slice(0, 12).map((n) => (
                <li
                  key={n.id}
                  className={
                    n.readAt
                      ? workspaceTextMuted
                      : 'text-[var(--workspace-shell-text)]'
                  }
                >
                  {n.summary}
                  {n.watchName ? (
                    <span className={`ml-1 ${workspaceTextMuted}`}>
                      · {n.watchName}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`${workspacePanelCard} overflow-hidden`}>
        <div className="max-h-[min(70vh,900px)] overflow-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={thClass}>Property</th>
                <th className={thClass}>Location</th>
                <th className={thClass}>Size</th>
                <th className={thClass}>Price / rent</th>
                <th className={thClass}>Tenure</th>
                <th className={thClass}>Agent</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Source</th>
                <th className={thClass}>Notes</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className={`px-4 py-10 text-center ${workspaceTextMuted}`}
                  >
                    No competitor listings yet. Add a row, import CSV, or paste
                    a Rightmove URL.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={row.name}
                        className="min-w-[12rem] font-medium"
                        onCommit={(name) =>
                          patchListing(
                            row.id,
                            { name },
                            { accountId, listingId: row.id, name },
                          )
                        }
                      />
                    </td>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={row.locationText ?? row.town ?? ''}
                        placeholder="Town / area"
                        className="min-w-[9rem]"
                        onCommit={(locationText) =>
                          patchListing(
                            row.id,
                            { locationText, town: locationText || null },
                            {
                              accountId,
                              listingId: row.id,
                              locationText,
                              town: locationText || null,
                            },
                          )
                        }
                      />
                    </td>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={
                          row.sizeSqft != null
                            ? String(Math.round(row.sizeSqft))
                            : ''
                        }
                        placeholder="sq ft"
                        className="w-24"
                        onCommit={(raw) => {
                          const n = raw.trim()
                            ? Number(raw.replace(/,/g, ''))
                            : null;
                          const sizeSqft =
                            n != null && Number.isFinite(n) ? n : null;
                          patchListing(
                            row.id,
                            { sizeSqft },
                            { accountId, listingId: row.id, sizeSqft },
                          );
                        }}
                      />
                    </td>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={formatCompetitorPricePence(row.pricePence)}
                        placeholder="£"
                        className="w-28"
                        onCommit={(raw) => {
                          const pricePence = parsePriceToPence(raw);
                          patchListing(
                            row.id,
                            { pricePence },
                            { accountId, listingId: row.id, pricePence },
                          );
                        }}
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        className={selectClass}
                        value={row.tenure ?? ''}
                        onChange={(e) => {
                          const tenure = (e.target.value ||
                            null) as CompetitorTenure | null;
                          patchListing(
                            row.id,
                            { tenure },
                            { accountId, listingId: row.id, tenure },
                          );
                        }}
                      >
                        <option value="">—</option>
                        {COMPETITOR_TENURES.map((key) => (
                          <option key={key} value={key}>
                            {COMPETITOR_TENURE_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={row.competitorAgent ?? ''}
                        placeholder="Agent"
                        className="min-w-[8rem]"
                        onCommit={(competitorAgent) =>
                          patchListing(
                            row.id,
                            { competitorAgent: competitorAgent || null },
                            {
                              accountId,
                              listingId: row.id,
                              competitorAgent: competitorAgent || null,
                            },
                          )
                        }
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        className={selectClass}
                        value={row.category}
                        onChange={(e) => {
                          const category = e.target.value as CompetitorCategory;
                          patchListing(
                            row.id,
                            { category },
                            { accountId, listingId: row.id, category },
                          );
                        }}
                      >
                        {COMPETITOR_CATEGORIES.map((key) => (
                          <option key={key} value={key}>
                            {COMPETITOR_CATEGORY_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <select
                        className={selectClass}
                        value={row.status}
                        onChange={(e) => {
                          const status = e.target.value as CompetitorStatus;
                          patchListing(
                            row.id,
                            { status },
                            { accountId, listingId: row.id, status },
                          );
                        }}
                      >
                        {COMPETITOR_STATUSES.map((key) => (
                          <option key={key} value={key}>
                            {COMPETITOR_STATUS_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      {row.sourceUrl ? (
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block max-w-[8rem] truncate text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                          title={row.sourceUrl}
                        >
                          Link
                        </a>
                      ) : (
                        <span className={workspaceTextMuted}>—</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <SheetTextCell
                        value={row.notes ?? ''}
                        placeholder="Notes"
                        className="min-w-[10rem]"
                        onCommit={(notes) =>
                          patchListing(
                            row.id,
                            { notes: notes || null },
                            {
                              accountId,
                              listingId: row.id,
                              notes: notes || null,
                            },
                          )
                        }
                      />
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          className="p-1 text-[var(--workspace-shell-text-muted)] hover:text-red-600"
                          onClick={() => onArchive(row)}
                          aria-label={`Archive ${row.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={listingOpen} onOpenChange={setListingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit competitor' : 'Add competitor'}
            </DialogTitle>
          </DialogHeader>
          <ListingFormFields draft={draft} setDraft={setDraft} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setListingOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={saveListingDialog}
              disabled={pending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV import */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
          </DialogHeader>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Header row should include name/property, price, agent, size,
            location, category (and optional url, status, notes).
          </p>
          <Textarea
            rows={10}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="name,location,size,price,agent,category&#10;Unit 4 Estate,Tunbridge Wells,5000,125000,Competitor & Co,industrial"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCsvOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={onImportCsv}
              disabled={pending}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL enrich */}
      <Dialog
        open={urlOpen}
        onOpenChange={(open) => {
          setUrlOpen(open);
          if (!open) {
            setEnrichment(null);
            setUrlValue('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste listing URL</DialogTitle>
          </DialogHeader>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Assisted entry from Rightmove or agent pages. Review fields before
            saving — scrapes are not guaranteed.
          </p>
          <div className="flex gap-2">
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://www.rightmove.co.uk/..."
            />
            <Button
              type="button"
              variant="outline"
              onClick={onEnrichUrl}
              disabled={pending}
            >
              Fetch
            </Button>
          </div>
          {enrichment && (
            <div className={`text-xs ${workspaceTextMuted}`}>
              Confidence: {enrichment.confidence}
              {enrichment.warnings.length
                ? ` · ${enrichment.warnings.join(' · ')}`
                : ''}
            </div>
          )}
          {enrichment && (
            <ListingFormFields draft={draft} setDraft={setDraft} />
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUrlOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={onSaveEnriched}
              disabled={pending || !enrichment}
            >
              Save listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Area watch */}
      <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New area watch</DialogTitle>
          </DialogHeader>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Matches ingested Tracker rows (CSV, URL paste, or licensed feed) —
            does not scrape Rightmove search pages.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={watchName}
                onChange={(e) => setWatchName(e.target.value)}
              />
            </div>
            <div>
              <Label>Towns (comma-separated)</Label>
              <Input
                value={watchTowns}
                onChange={(e) => setWatchTowns(e.target.value)}
              />
            </div>
            <div>
              <Label>Postcode prefixes</Label>
              <Input
                value={watchPrefixes}
                onChange={(e) => setWatchPrefixes(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {COMPETITOR_CATEGORIES.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={watchCategories.includes(key)}
                    onCheckedChange={(checked) => {
                      setWatchCategories((prev) =>
                        checked
                          ? [...prev, key]
                          : prev.filter((c) => c !== key),
                      );
                    }}
                  />
                  {COMPETITOR_CATEGORY_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWatchOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={onCreateWatch}
              disabled={pending || watchCategories.length === 0}
            >
              Create watch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListingFormFields({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: (next: ListingDraft) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Property name</Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div>
        <Label>Location</Label>
        <Input
          value={draft.locationText}
          onChange={(e) => setDraft({ ...draft, locationText: e.target.value })}
        />
      </div>
      <div>
        <Label>Postcode</Label>
        <Input
          value={draft.postcode}
          onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
        />
      </div>
      <div>
        <Label>Size (sq ft)</Label>
        <Input
          value={draft.sizeSqft}
          onChange={(e) => setDraft({ ...draft, sizeSqft: e.target.value })}
        />
      </div>
      <div>
        <Label>Price / rent (£)</Label>
        <Input
          value={draft.priceDisplay}
          onChange={(e) => setDraft({ ...draft, priceDisplay: e.target.value })}
        />
      </div>
      <div>
        <Label>Tenure</Label>
        <Select
          value={draft.tenure || '__none__'}
          onValueChange={(v) =>
            setDraft({
              ...draft,
              tenure: v === '__none__' ? '' : (v as CompetitorTenure),
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {COMPETITOR_TENURES.map((key) => (
              <SelectItem key={key} value={key}>
                {COMPETITOR_TENURE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Competitor agent</Label>
        <Input
          value={draft.competitorAgent}
          onChange={(e) =>
            setDraft({ ...draft, competitorAgent: e.target.value })
          }
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select
          value={draft.category}
          onValueChange={(v) =>
            setDraft({ ...draft, category: v as CompetitorCategory })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPETITOR_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {COMPETITOR_CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select
          value={draft.status}
          onValueChange={(v) =>
            setDraft({ ...draft, status: v as CompetitorStatus })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPETITOR_STATUSES.map((key) => (
              <SelectItem key={key} value={key}>
                {COMPETITOR_STATUS_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label>Source URL</Label>
        <Input
          value={draft.sourceUrl}
          onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Textarea
          rows={3}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>
    </div>
  );
}
