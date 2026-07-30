'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Edit2, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import {
  REQUIREMENT_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
} from '~/lib/workspace-ui';

import type { CommercialRequirement } from '../_lib/server/requirements.service';
import { deleteRequirement } from '../_lib/server/server-actions';
import { RequirementFormModal } from './requirement-form-modal';

interface RequirementsListProps {
  accountId: string;
  initialRequirements: CommercialRequirement[];
}

export function RequirementsList({
  accountId,
  initialRequirements,
}: RequirementsListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialRequirements);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialRequirement | null>(null);
  const [, startTransition] = useTransition();

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this requirement?')) return;
    startTransition(async () => {
      await deleteRequirement({ requirementId: id, accountId });
      setItems((prev) => prev.filter((r) => r.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Requirements
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {items.length} applicant {items.length === 1 ? 'brief' : 'briefs'}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className={workspaceBtnPrimaryMd}
        >
          <Plus className="h-4 w-4" />
          Add requirement
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No requirements yet
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Capture applicant briefs to match against stock.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Location
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Size
                </th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--workspace-shell-text)]">
                      {req.companyName || req.contactName || 'Untitled'}
                    </div>
                    {req.companyName && req.contactName ? (
                      <div className="text-xs text-[var(--workspace-shell-text)]/45">
                        {req.contactName}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 md:table-cell">
                    {req.locationText || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 lg:table-cell">
                    {req.sizeMinSqft != null || req.sizeMaxSqft != null
                      ? `${[req.sizeMinSqft, req.sizeMaxSqft].filter((v) => v != null).join('–')} sq ft`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
                      {REQUIREMENT_STATUS_LABELS[req.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditing(req);
                          setModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-400"
                        onClick={() => handleDelete(req.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequirementFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        requirement={editing}
        onSaved={handleSaved}
      />
    </div>
  );
}
