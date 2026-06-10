'use client';

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Bath, Bed, Building2, Calendar, Edit2, Home, MapPin, Maximize2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import type { Property, PropertyDocument } from '../../_lib/server/properties.service';
import { PropertyFormModal } from '../../_components/property-form-modal';
import { ContextWorkspaceNotes } from '../../../_components/workspace-content/context-workspace-notes';
import type { LinkValue } from '../../../_components/workspace-content/link-to-select';
import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../../_lib/workspace-content/types';
import { PropertyDocumentsTab } from './property-documents-tab';

interface PropertyDetailContentProps {
  property: Property;
  accountId: string;
  accountSlug: string;
  userId: string;
  documents: PropertyDocument[];
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
  active: { bg: 'bg-[var(--keel-teal)]/15', text: 'text-[#5eead4]', label: 'Active' },
  vacant: { bg: 'bg-amber-500/15', text: 'text-amber-300', label: 'Vacant' },
  maintenance: { bg: 'bg-orange-500/15', text: 'text-orange-300', label: 'Maintenance' },
  sold: { bg: 'bg-sky-500/15', text: 'text-sky-300', label: 'Sold' },
  archived: { bg: 'bg-white/5', text: 'text-white/40', label: 'Archived' },
};

const typeLabels: Record<Property['propertyType'], string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  land: 'Land',
  other: 'Other',
};

export function PropertyDetailContent({
  property: initialProperty,
  accountId,
  accountSlug,
  userId,
  documents,
  workspaceNotes,
  workspaceDocs,
  notesTableAvailable,
  docsTableAvailable,
  linkOptions,
  defaultLink,
  notesVariant,
}: PropertyDetailContentProps) {
  const router = useRouter();
  const [property] = useState(initialProperty);
  const [editOpen, setEditOpen] = useState(false);

  const status = statusStyles[property.status];

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
                <Home className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-white">{property.name}</h1>
                {property.address && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
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
                  <span className="text-xs text-white/40">{typeLabels[property.propertyType]}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setEditOpen(true)}
              variant="outline"
              className="gap-2 border-white/10 bg-white/5 text-white/70 hover:text-white"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/6 pt-5 sm:grid-cols-4">
            {property.bedrooms != null && (
              <StatPill icon={Bed} label="Bedrooms" value={String(property.bedrooms)} />
            )}
            {property.bathrooms != null && (
              <StatPill icon={Bath} label="Bathrooms" value={String(property.bathrooms)} />
            )}
            {property.squareFootage != null && (
              <StatPill icon={Maximize2} label="Sq ft" value={property.squareFootage.toLocaleString()} />
            )}
            {property.currentValue != null && (
              <StatPill
                icon={Building2}
                label="Est. Value"
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

      {/* Tabs */}
      <Card className="rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <CardContent className="p-6">
          <Tabs defaultValue="documents">
            <TabsList className="mb-6 grid h-11 w-full grid-cols-2 rounded-xl border border-white/6 bg-[var(--workspace-control-surface)]/80 p-1 text-xs sm:w-auto sm:grid-cols-2">
              <TabsTrigger
                value="documents"
                className="gap-2 text-white/60 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-200 data-[state=active]:border data-[state=active]:border-violet-400/40"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="gap-2 text-white/60 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-200 data-[state=active]:border data-[state=active]:border-violet-400/40"
              >
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-0">
              <PropertyDocumentsTab
                propertyId={property.id}
                accountId={accountId}
                userId={userId}
                initialDocuments={documents}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-8">
              <section>
                <h3 className="mb-3 text-sm font-medium text-white/50">
                  Property description
                </h3>
                <PropertyNotesTab property={property} />
              </section>
              <section>
                <h3 className="mb-3 text-sm font-medium text-white/50">
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
    <div className="rounded-xl border border-white/6 bg-[var(--workspace-shell-canvas)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PropertyNotesTab({ property }: { property: Property }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {property.notes ? (
        <div className="rounded-xl border border-white/6 bg-[var(--workspace-shell-canvas)] p-4">
          <p className="whitespace-pre-wrap text-sm text-white/80">{property.notes}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-white/40">No notes for this property.</p>
          <p className="mt-1 text-xs text-white/30">
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
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
