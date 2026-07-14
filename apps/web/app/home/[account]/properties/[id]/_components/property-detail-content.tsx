'use client';

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Bath,
  Bed,
  Building2,
  Calendar,
  Edit2,
  Home,
  Landmark,
  MapPin,
  Maximize2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  workspaceIconChip,
  workspacePanelCard,
} from '~/lib/workspace-ui';

import type {
  Property,
  PropertyValuation,
} from '../../_lib/server/properties.service';
import { PropertyFormModal } from '../../_components/property-form-modal';
import { ContextWorkspaceNotes } from '../../../_components/workspace-content/context-workspace-notes';
import type { LinkValue } from '../../../_components/workspace-content/link-to-select';
import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../../_lib/workspace-content/types';
import { PropertyValueHistory } from './property-value-history';

interface PropertyDetailContentProps {
  property: Property;
  valuations: PropertyValuation[];
  accountId: string;
  accountSlug: string;
  workspaceNotes: NoteListItem[];
  workspaceDocs: DocListItem[];
  notesTableAvailable: boolean;
  docsTableAvailable: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  notesVariant: WorkspaceNotesVariant;
}

const statusStyles: Record<
  Property['status'],
  { bg: string; text: string; label: string }
> = {
  active: {
    bg: 'bg-[var(--ozer-accent-subtle)]',
    text: 'text-[var(--workspace-shell-accent-text)]',
    label: 'Active',
  },
  vacant: {
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]',
    text: 'text-[var(--workspace-shell-text-muted)]',
    label: 'Vacant',
  },
  maintenance: {
    bg: 'bg-[var(--ozer-accent-subtle)]',
    text: 'text-[var(--ozer-accent-muted)]',
    label: 'Maintenance',
  },
  sold: {
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]',
    text: 'text-[var(--workspace-shell-text)]/50',
    label: 'Sold',
  },
  archived: {
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]',
    text: 'text-[var(--workspace-shell-text)]/40',
    label: 'Archived',
  },
};

const tabTriggerClass =
  'gap-2 text-[var(--workspace-shell-text)]/60 data-[state=active]:border data-[state=active]:border-[var(--ozer-accent)]/30 data-[state=active]:bg-[var(--ozer-accent-subtle)] data-[state=active]:text-[var(--workspace-shell-accent-text)]';

const typeLabels: Record<Property['propertyType'], string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  land: 'Land',
  other: 'Other',
};

function hasMortgageDetails(property: Property) {
  return Boolean(
    property.mortgageLender ||
      property.mortgageReference ||
      property.mortgageBalance != null ||
      property.mortgageInterestRate != null ||
      property.mortgageMonthlyPayment != null ||
      property.mortgageStartDate ||
      property.mortgageEndDate ||
      property.mortgageNotes,
  );
}

export function PropertyDetailContent({
  property,
  valuations,
  accountId,
  accountSlug,
  workspaceNotes,
  workspaceDocs,
  notesTableAvailable,
  docsTableAvailable,
  linkOptions,
  defaultLink,
  notesVariant,
}: PropertyDetailContentProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const status = statusStyles[property.status];

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const equity =
    property.currentValue != null && property.mortgageBalance != null
      ? property.currentValue - property.mortgageBalance
      : null;

  return (
    <div className="space-y-6">
      <Card className={workspacePanelCard}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${workspaceIconChip}`}
              >
                <Home className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-[var(--workspace-shell-text)]">
                  {property.name}
                </h1>
                {property.address && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text)]/50">
                    <MapPin className="h-3.5 w-3.5" />
                    {property.address}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
                  >
                    {status.label}
                  </span>
                  <span className="text-xs text-[var(--workspace-shell-text)]/40">
                    {typeLabels[property.propertyType]}
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setEditOpen(true)}
              variant="outline"
              className="gap-2 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:text-[var(--workspace-shell-text)]"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[color:var(--workspace-shell-border)] pt-5 sm:grid-cols-4">
            {property.bedrooms != null && (
              <StatPill icon={Bed} label="Bedrooms" value={String(property.bedrooms)} />
            )}
            {property.bathrooms != null && (
              <StatPill
                icon={Bath}
                label="Bathrooms"
                value={String(property.bathrooms)}
              />
            )}
            {property.squareFootage != null && (
              <StatPill
                icon={Maximize2}
                label="Sq ft"
                value={property.squareFootage.toLocaleString()}
              />
            )}
            {property.currentValue != null && (
              <StatPill
                icon={Building2}
                label="Current value"
                value={formatCurrency(property.currentValue / 100)}
              />
            )}
            {property.purchaseDate && (
              <StatPill
                icon={Calendar}
                label="Purchased"
                value={formatDate(property.purchaseDate)}
              />
            )}
            {property.purchasePrice != null && (
              <StatPill
                icon={Building2}
                label="Purchase Price"
                value={formatCurrency(property.purchasePrice / 100)}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${workspaceIconChip}`}
              >
                <Landmark className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Mortgage
                </h2>
                <p className="text-xs text-[var(--workspace-shell-text)]/45">
                  Lender, balance, and repayment details for this property.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setEditOpen(true)}
              variant="ghost"
              size="sm"
              className="text-[var(--workspace-shell-text)]/50 hover:text-[var(--ozer-accent-muted)]"
            >
              Edit
            </Button>
          </div>

          {hasMortgageDetails(property) ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {property.mortgageLender ? (
                <StatPill
                  icon={Landmark}
                  label="Lender"
                  value={property.mortgageLender}
                />
              ) : null}
              {property.mortgageReference ? (
                <StatPill
                  icon={Landmark}
                  label="Reference"
                  value={property.mortgageReference}
                />
              ) : null}
              {property.mortgageBalance != null ? (
                <StatPill
                  icon={Building2}
                  label="Balance"
                  value={formatCurrency(property.mortgageBalance / 100)}
                />
              ) : null}
              {property.mortgageInterestRate != null ? (
                <StatPill
                  icon={Building2}
                  label="Interest rate"
                  value={`${property.mortgageInterestRate}%`}
                />
              ) : null}
              {property.mortgageMonthlyPayment != null ? (
                <StatPill
                  icon={Building2}
                  label="Monthly payment"
                  value={formatCurrency(property.mortgageMonthlyPayment / 100)}
                />
              ) : null}
              {property.mortgageStartDate ? (
                <StatPill
                  icon={Calendar}
                  label="Start"
                  value={formatDate(property.mortgageStartDate)}
                />
              ) : null}
              {property.mortgageEndDate ? (
                <StatPill
                  icon={Calendar}
                  label="Term end"
                  value={formatDate(property.mortgageEndDate)}
                />
              ) : null}
              {equity != null ? (
                <StatPill
                  icon={Building2}
                  label="Est. equity"
                  value={formatCurrency(equity / 100)}
                />
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--workspace-shell-text)]/45">
                No mortgage details yet
              </p>
              <Button
                onClick={() => setEditOpen(true)}
                variant="ghost"
                className="mt-2 text-[var(--ozer-accent-muted)]"
              >
                Add mortgage details
              </Button>
            </div>
          )}

          {property.mortgageNotes ? (
            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-3 text-sm text-[var(--workspace-shell-text)]/70">
              {property.mortgageNotes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardContent className="p-6">
          <PropertyValueHistory
            propertyId={property.id}
            accountId={accountId}
            valuations={valuations}
          />
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardContent className="p-6">
          <Tabs defaultValue="documents">
            <TabsList className="mb-6 grid h-11 w-full grid-cols-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/80 p-1 text-xs sm:w-auto sm:grid-cols-2">
              <TabsTrigger value="documents" className={tabTriggerClass}>
                Documents
              </TabsTrigger>
              <TabsTrigger value="notes" className={tabTriggerClass}>
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-0">
              <ContextWorkspaceNotes
                accountId={accountId}
                accountSlug={accountSlug}
                notes={workspaceNotes}
                docs={workspaceDocs}
                tableAvailable={notesTableAvailable}
                docsTableAvailable={docsTableAvailable}
                linkOptions={linkOptions}
                defaultLink={defaultLink}
                variant={notesVariant}
                initialListFilter="files"
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-8">
              <section>
                <h3 className="mb-3 text-sm font-medium text-[var(--workspace-shell-text)]/50">
                  Property description
                </h3>
                <PropertyNotesTab property={property} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-medium text-[var(--workspace-shell-text)]/50">
                  Notes and files
                </h3>
                <ContextWorkspaceNotes
                  accountId={accountId}
                  accountSlug={accountSlug}
                  notes={workspaceNotes}
                  docs={workspaceDocs}
                  tableAvailable={notesTableAvailable}
                  docsTableAvailable={docsTableAvailable}
                  linkOptions={linkOptions}
                  defaultLink={defaultLink}
                  variant={notesVariant}
                  initialListFilter="notes"
                />
              </section>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PropertyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        accountId={accountId}
        property={property}
        onSaved={handleSaved}
      />
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text)]/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--workspace-shell-text)]">
        {value}
      </p>
    </div>
  );
}

function PropertyNotesTab({ property }: { property: Property }) {
  return (
    <div className="prose prose-sm max-w-none">
      {property.notes ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-4">
          <p className="whitespace-pre-wrap text-sm text-[var(--workspace-shell-text)]/80">
            {property.notes}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-[var(--workspace-shell-text)]/40">
            No notes for this property.
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/30">
            Edit the property to add notes.
          </p>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
