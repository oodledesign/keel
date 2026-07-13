'use client';

import { useCallback, useState, useTransition } from 'react';

import {
  Building2,
  Edit2,
  Home,
  MapPin,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import type { Property } from '../_lib/server/properties.service';
import { deleteProperty } from '../_lib/server/server-actions';
import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspaceIconChip,
  workspacePanelCard,
} from '~/lib/workspace-ui';
import { PropertyFormModal } from './property-form-modal';

interface PropertiesListProps {
  accountId: string;
  accountSlug: string;
  initialProperties: Property[];
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

const typeIcons: Record<Property['propertyType'], React.ReactNode> = {
  residential: <Home className="h-4 w-4" />,
  commercial: <Building2 className="h-4 w-4" />,
  land: <MapPin className="h-4 w-4" />,
  other: <Building2 className="h-4 w-4" />,
};

export function PropertiesList({
  accountId,
  accountSlug,
  initialProperties,
}: PropertiesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [, startTransition] = useTransition();

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('create') !== 'property') return;
    setEditing(null);
    setModalOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('create');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const openEdit = (property: Property) => {
    setEditing(property);
    setModalOpen(true);
  };

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = useCallback(
    (propertyId: string) => {
      if (!confirm('Are you sure you want to delete this property? This cannot be undone.')) {
        return;
      }
      startTransition(async () => {
        try {
          await deleteProperty({ propertyId });
          setProperties((prev) => prev.filter((p) => p.id !== propertyId));
        } catch (err) {
          console.error(err);
        }
      });
    },
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Properties
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className={workspaceBtnPrimaryMd}
        >
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* List */}
      {properties.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="text-[var(--workspace-shell-text)] font-medium">No properties yet</p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Add your first property to get started.
            </p>
            <Button
              onClick={openCreate}
              className={`mt-4 ${workspaceBtnPrimaryMd}`}
            >
              <Plus className="h-4 w-4" />
              Add Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const status = statusStyles[property.status];
            return (
              <Card
                key={property.id}
                className={`group ${workspacePanelCard} transition-colors hover:border-[var(--ozer-accent)]/25`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${workspaceIconChip}`}
                      >
                        {typeIcons[property.propertyType]}
                      </span>
                      <div>
                        <Link
                          href={pathsConfig.app.accountPropertyDetail
                            .replace('[account]', accountSlug)
                            .replace('[id]', property.id)}
                          className="text-sm font-semibold text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)] transition-colors"
                        >
                          {property.name}
                        </Link>
                        {property.address && (
                          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text)]/50 line-clamp-1">
                            {property.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--workspace-shell-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--workspace-shell-text)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => openEdit(property)}
                          className="gap-2"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => handleDelete(property.id)}
                          className="gap-2 text-rose-400 focus:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Details row */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.bg} ${status.text}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-[11px] capitalize text-[var(--workspace-shell-text)]/40">
                      {property.propertyType}
                    </span>
                    {property.bedrooms != null && (
                      <span className="text-[11px] text-[var(--workspace-shell-text)]/40">
                        {property.bedrooms} bed
                      </span>
                    )}
                    {property.bathrooms != null && (
                      <span className="text-[11px] text-[var(--workspace-shell-text)]/40">
                        {property.bathrooms} bath
                      </span>
                    )}
                  </div>

                  {/* Value */}
                  {property.currentValue != null && (
                    <p className="mt-3 text-sm font-semibold text-[var(--workspace-shell-text)]">
                      {formatCurrency(property.currentValue / 100)}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="mt-4 border-t border-[color:var(--workspace-shell-border)] pt-3">
                    <Link
                      href={pathsConfig.app.accountPropertyDetail
                        .replace('[account]', accountSlug)
                        .replace('[id]', property.id)}
                      className="text-xs font-medium text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)] transition-colors"
                    >
                      View details →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PropertyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        property={editing}
        onSaved={handleSaved}
      />
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
