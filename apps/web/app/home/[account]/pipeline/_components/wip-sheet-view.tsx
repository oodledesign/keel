'use client';

import { type KeyboardEvent, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { updateDeal } from '~/home/(user)/pipeline/actions';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { updateRequirement } from '~/home/[account]/requirements/_lib/server/server-actions';
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from '~/lib/commercial/commercial-constants';
import {
  isCommercialTerminalStage,
  normalizeCommercialPipelineStage,
} from '~/lib/commercial/pipeline-stage-config';
import type { WipBoardView } from '~/lib/commercial/wip-board-mapping';
import { workspaceTextMuted } from '~/lib/workspace-ui';

type Props = {
  accountId: string;
  accountSlug: string;
  view: WipBoardView;
  deals: PipelineDeal[];
  requirements: CommercialRequirement[];
  instructionStages: Array<{ key: string; label: string }>;
  listings?: PipelineListingOption[];
  onDealsChange: (next: PipelineDeal[]) => void;
  onRequirementsChange: (next: CommercialRequirement[]) => void;
  onEditRequirement: (requirement: CommercialRequirement) => void;
  onEditInstruction: (deal: PipelineDeal) => void;
};

const cellInputClass =
  'h-8 w-full min-w-[6rem] rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--workspace-shell-text)] outline-none transition-colors hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const selectClass =
  'h-8 w-full min-w-[7rem] rounded-md border border-transparent bg-transparent px-1.5 text-sm text-[var(--workspace-shell-text)] outline-none hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const thClass =
  'sticky top-0 z-10 whitespace-nowrap border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-2 text-left text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text)]/55';

const tdClass =
  'border-b border-[color:var(--workspace-shell-border)]/70 px-1.5 py-1 align-middle';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB');
  } catch {
    return '';
  }
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
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

export function WipSheetView({
  accountId,
  accountSlug,
  view,
  deals,
  requirements,
  instructionStages,
  listings = [],
  onDealsChange,
  onRequirementsChange,
  onEditRequirement,
  onEditInstruction,
}: Props) {
  const [, startTransition] = useTransition();

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) map.set(listing.id, listing);
    return map;
  }, [listings]);

  const activeDeals = useMemo(
    () =>
      deals
        .filter((d) => !isCommercialTerminalStage(d.stage))
        .slice()
        .sort((a, b) =>
          (a.companyName || a.contactName).localeCompare(
            b.companyName || b.contactName,
          ),
        ),
    [deals],
  );

  const sortedRequirements = useMemo(
    () =>
      requirements
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [requirements],
  );

  const showInstructions = view === 'instructions' || view === 'both';
  const showRequirements = view === 'requirements' || view === 'both';

  const patchRequirement = (
    id: string,
    patch: Partial<CommercialRequirement>,
    serverPatch: Record<string, unknown>,
  ) => {
    const previous = requirements;
    onRequirementsChange(
      requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    startTransition(async () => {
      try {
        const updated = await updateRequirement({
          accountId,
          requirementId: id,
          ...serverPatch,
        });
        onRequirementsChange(previous.map((r) => (r.id === id ? updated : r)));
      } catch (error) {
        onRequirementsChange(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not save requirement',
        );
      }
    });
  };

  const patchDeal = (
    id: string,
    patch: Partial<PipelineDeal>,
    serverPatch: Parameters<typeof updateDeal>[1],
  ) => {
    const previous = deals;
    onDealsChange(deals.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    startTransition(async () => {
      try {
        await updateDeal(id, { ...serverPatch, accountSlug });
      } catch (error) {
        onDealsChange(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not save instruction',
        );
      }
    });
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-4 pb-4 md:px-6 lg:px-8">
      {showRequirements ? (
        <section
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] ${
            showInstructions ? 'max-h-[45vh] shrink-0' : 'flex-1'
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Requirements sheet
              </h3>
              <p className={`text-xs ${workspaceTextMuted}`}>
                Edit like a spreadsheet — changes save when you leave a cell
              </p>
            </div>
            <span className={`text-xs tabular-nums ${workspaceTextMuted}`}>
              {sortedRequirements.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Updated</th>
                  <th className={thClass}>Company</th>
                  <th className={thClass}>Contact</th>
                  <th className={thClass}>Tel</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Use / sector</th>
                  <th className={thClass}>Tenure</th>
                  <th className={thClass}>Size min</th>
                  <th className={thClass}>Size max</th>
                  <th className={thClass}>Location</th>
                  <th className={thClass}>Stage</th>
                  <th className={`${thClass} min-w-[16rem]`}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedRequirements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className={`px-3 py-8 text-center text-sm ${workspaceTextMuted}`}
                    >
                      No requirements yet — add one to start tracking briefs.
                    </td>
                  </tr>
                ) : (
                  sortedRequirements.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[var(--workspace-shell-sidebar-accent)]/25"
                    >
                      <td className={`${tdClass} px-2`}>
                        <button
                          type="button"
                          className={`text-left text-xs underline-offset-2 hover:underline ${workspaceTextMuted}`}
                          onClick={() => onEditRequirement(row)}
                          title="Open full editor"
                        >
                          {formatDate(row.updatedAt)}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.companyName ?? ''}
                          placeholder="Company"
                          className="min-w-[9rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { companyName: next.trim() || null },
                              { companyName: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.contactName ?? ''}
                          placeholder="Contact"
                          className="min-w-[8rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { contactName: next.trim() || null },
                              { contactName: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.contactPhone ?? ''}
                          placeholder="Tel"
                          className="min-w-[7rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { contactPhone: next.trim() || null },
                              { contactPhone: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.contactEmail ?? ''}
                          placeholder="Email"
                          className="min-w-[10rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { contactEmail: next.trim() || null },
                              { contactEmail: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.sector ?? ''}
                          placeholder="Class E / Industrial…"
                          className="min-w-[8rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { sector: next.trim() || null },
                              { sector: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <select
                          className={selectClass}
                          value={row.tenure ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const tenure =
                              raw === 'rent' || raw === 'buy' || raw === 'both'
                                ? raw
                                : null;
                            patchRequirement(row.id, { tenure }, { tenure });
                          }}
                        >
                          <option value="">—</option>
                          <option value="rent">LH / Rent</option>
                          <option value="buy">FH / Buy</option>
                          <option value="both">Either</option>
                        </select>
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={
                            row.sizeMinSqft != null
                              ? String(row.sizeMinSqft)
                              : ''
                          }
                          placeholder="Min"
                          className="min-w-[5rem] tabular-nums"
                          onCommit={(next) => {
                            const sizeMinSqft = parseOptionalNumber(next);
                            patchRequirement(
                              row.id,
                              { sizeMinSqft },
                              { sizeMinSqft },
                            );
                          }}
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={
                            row.sizeMaxSqft != null
                              ? String(row.sizeMaxSqft)
                              : ''
                          }
                          placeholder="Max"
                          className="min-w-[5rem] tabular-nums"
                          onCommit={(next) => {
                            const sizeMaxSqft = parseOptionalNumber(next);
                            patchRequirement(
                              row.id,
                              { sizeMaxSqft },
                              { sizeMaxSqft },
                            );
                          }}
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.locationText ?? ''}
                          placeholder="Location"
                          className="min-w-[9rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { locationText: next.trim() || null },
                              { locationText: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <select
                          className={selectClass}
                          value={row.stage}
                          onChange={(e) => {
                            const stage = e.target.value as RequirementStatus;
                            patchRequirement(row.id, { stage }, { stage });
                          }}
                        >
                          {REQUIREMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {REQUIREMENT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={row.notes ?? ''}
                          placeholder="Notes / timing…"
                          className="min-w-[16rem]"
                          onCommit={(next) =>
                            patchRequirement(
                              row.id,
                              { notes: next.trim() || null },
                              { notes: next.trim() || null },
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showInstructions ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Instructions sheet
              </h3>
              <p className={`text-xs ${workspaceTextMuted}`}>
                Landlord mandates — edit inline, open a row for full detail
              </p>
            </div>
            <span className={`text-xs tabular-nums ${workspaceTextMuted}`}>
              {activeDeals.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Title</th>
                  <th className={thClass}>Company</th>
                  <th className={thClass}>Contact</th>
                  <th className={thClass}>Disposal</th>
                  <th className={thClass}>Value</th>
                  <th className={thClass}>Stage</th>
                  <th className={thClass}>Next action</th>
                  <th className={thClass}>Due</th>
                  <th className={`${thClass} min-w-[14rem]`}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {activeDeals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className={`px-3 py-8 text-center text-sm ${workspaceTextMuted}`}
                    >
                      No active instructions.
                    </td>
                  </tr>
                ) : (
                  activeDeals.map((deal) => {
                    const listing = deal.commercialListingId
                      ? listingById.get(deal.commercialListingId)
                      : null;
                    return (
                    <tr
                      key={deal.id}
                      className="hover:bg-[var(--workspace-shell-sidebar-accent)]/25"
                    >
                      <td className={tdClass}>
                        <SheetTextCell
                          value={deal.projectName ?? ''}
                          placeholder="Instruction"
                          className="min-w-[10rem] font-medium"
                          onCommit={(next) =>
                            patchDeal(
                              deal.id,
                              { projectName: next.trim() || null },
                              { projectName: next.trim() || null },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={deal.companyName}
                          placeholder="Company"
                          className="min-w-[8rem]"
                          onCommit={(next) =>
                            patchDeal(
                              deal.id,
                              { companyName: next },
                              { companyName: next },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={deal.contactName}
                          placeholder="Contact"
                          className="min-w-[8rem]"
                          onCommit={(next) =>
                            patchDeal(
                              deal.id,
                              { contactName: next },
                              { contactName: next },
                            )
                          }
                        />
                      </td>
                      <td className={`${tdClass} px-2`}>
                        {deal.commercialListingId ? (
                          <Link
                            href={pathsConfig.app.accountListingDetail
                              .replace('[account]', accountSlug)
                              .replace('[id]', deal.commercialListingId)}
                            className="block max-w-[12rem] truncate text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
                            title="Open disposal"
                          >
                            {listing?.name?.trim() || 'Open disposal'}
                          </Link>
                        ) : (
                          <span className={`text-xs ${workspaceTextMuted}`}>
                            —
                          </span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={deal.value ? String(deal.value) : ''}
                          placeholder="0"
                          className="min-w-[6rem] tabular-nums"
                          onCommit={(next) => {
                            const value = parseOptionalNumber(next) ?? 0;
                            patchDeal(deal.id, { value }, { value });
                          }}
                        />
                      </td>
                      <td className={tdClass}>
                        <select
                          className={selectClass}
                          value={normalizeCommercialPipelineStage(deal.stage)}
                          onChange={(e) => {
                            const stage = e.target.value;
                            patchDeal(deal.id, { stage }, { stage });
                          }}
                        >
                          {instructionStages.map((stage) => (
                            <option key={stage.key} value={stage.key}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tdClass}>
                        <SheetTextCell
                          value={deal.nextAction}
                          placeholder="Next action"
                          className="min-w-[9rem]"
                          onCommit={(next) =>
                            patchDeal(
                              deal.id,
                              { nextAction: next },
                              { nextAction: next },
                            )
                          }
                        />
                      </td>
                      <td className={tdClass}>
                        <input
                          type="date"
                          className={selectClass}
                          defaultValue={deal.nextActionDate?.slice(0, 10) ?? ''}
                          key={`${deal.id}-due-${deal.nextActionDate ?? ''}`}
                          onBlur={(e) => {
                            const nextActionDate = e.target.value || null;
                            const current =
                              deal.nextActionDate?.slice(0, 10) || null;
                            if (nextActionDate === current) return;
                            patchDeal(
                              deal.id,
                              { nextActionDate },
                              { nextActionDate },
                            );
                          }}
                        />
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1">
                          <SheetTextCell
                            value={deal.description ?? ''}
                            placeholder="Notes"
                            className="min-w-[12rem]"
                            onCommit={(next) =>
                              patchDeal(
                                deal.id,
                                { description: next.trim() || null },
                                { description: next.trim() || null },
                              )
                            }
                          />
                          <button
                            type="button"
                            className={`shrink-0 px-1 text-[11px] ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
                            onClick={() => onEditInstruction(deal)}
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
