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
  active: { bg: 'bg-[var(--keel-teal)]/15', text: 'text-[#5eead4]', label: 'Active' },
  vacant: { bg: 'bg-amber-500/15', text: 'text-amber-300', label: 'Vacant' },
  maintenance: { bg: 'bg-orange-500/15', text: 'text-orange-300', label: 'Maintenance' },
  sold: { bg: 'bg-sky-500/15', text: 'text-sky-300', label: 'Sold' },
  archived: { bg: 'bg-white/5', text: 'text-white/40', label: 'Archived' },
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
          <h2 className="text-lg font-semibold text-white">
            Properties
          </h2>
          <p className="text-sm text-white/50">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* List */}
      {properties.length === 0 ? (
        <Card className="rounded-[24px] border border-white/6 bg-[var(--workspace-shell-panel)]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-white/20" />
            <p className="text-white font-medium">No properties yet</p>
            <p className="mt-1 text-sm text-white/50">
              Add your first property to get started.
            </p>
            <Button
              onClick={openCreate}
              className="mt-4 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
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
                className="group rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_8px_24px_rgba(4,10,24,0.18)] transition-all hover:border-white/10 hover:shadow-[0_12px_32px_rgba(4,10,24,0.24)]"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                        {typeIcons[property.propertyType]}
                      </span>
                      <div>
                        <Link
                          href={`/app/work/${accountSlug}/properties/${property.id}`}
                          className="text-sm font-semibold text-white hover:text-violet-300 transition-colors"
                        >
                          {property.name}
                        </Link>
                        {property.address && (
                          <p className="mt-0.5 text-xs text-white/50 line-clamp-1">
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
                          className="h-7 w-7 text-white/40 opacity-0 group-hover:opacity-100 hover:text-white"
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
                    <span className="text-[11px] capitalize text-white/40">
                      {property.propertyType}
                    </span>
                    {property.bedrooms != null && (
                      <span className="text-[11px] text-white/40">
                        {property.bedrooms} bed
                      </span>
                    )}
                    {property.bathrooms != null && (
                      <span className="text-[11px] text-white/40">
                        {property.bathrooms} bath
                      </span>
                    )}
                  </div>

                  {/* Value */}
                  {property.currentValue != null && (
                    <p className="mt-3 text-sm font-semibold text-violet-300">
                      {formatCurrency(property.currentValue / 100)}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="mt-4 border-t border-white/6 pt-3">
                    <Link
                      href={`/app/work/${accountSlug}/properties/${property.id}`}
                      className="text-xs font-medium text-white/50 hover:text-white transition-colors"
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
