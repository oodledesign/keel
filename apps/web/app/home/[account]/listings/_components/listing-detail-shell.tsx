'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Activity,
  Archive,
  Camera,
  ChevronDown,
  Copy,
  Edit2,
  Eye,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Settings2,
  Users,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import {
  archiveListing,
  duplicateListing,
} from '../_lib/server/server-actions';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import { ListingFormModal } from './listing-form-modal';
import { ListingSectorPills } from './listing-sector-pills';

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, href: '' },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, href: '/marketing' },
  { key: 'media', label: 'Media', icon: Camera, href: '/media' },
  { key: 'interest', label: 'Interest', icon: Users, href: '/interest' },
  {
    key: 'availability',
    label: 'Availability',
    icon: FileText,
    href: '/availability',
  },
  {
    key: 'management',
    label: 'Management',
    icon: Settings2,
    href: '/management',
  },
  { key: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
] as const;

function listingAddress(listing: CommercialListing) {
  return [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.county,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatUpdatedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ListingDetailShell({
  listing: initialListing,
  accountSlug,
  accountId,
  children,
}: {
  listing: CommercialListing;
  accountSlug: string;
  accountId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  const base = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id);

  const isOverview = pathname === base || pathname === `${base}/`;
  const address = listingAddress(listing);
  const isArchived = listing.status === 'withdrawn';

  const onDuplicate = () => {
    startTransition(async () => {
      const toastId = toast.loading('Duplicating disposal…');
      try {
        const copy = await duplicateListing({
          listingId: listing.id,
          accountId,
          accountSlug,
        });
        toast.success('Disposal duplicated', { id: toastId });
        router.push(
          pathsConfig.app.accountListingDetail
            .replace('[account]', accountSlug)
            .replace('[id]', copy.id),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not duplicate',
          { id: toastId },
        );
      }
    });
  };

  const onArchive = () => {
    startTransition(async () => {
      const toastId = toast.loading('Archiving disposal…');
      try {
        const updated = await archiveListing({
          listingId: listing.id,
          accountId,
        });
        setListing(updated);
        setArchiveOpen(false);
        toast.success('Disposal archived (withdrawn)', { id: toastId });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not archive',
          { id: toastId },
        );
      }
    });
  };

  const headerActions = (
    <div className="flex shrink-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="inline-flex items-center gap-1.5"
          >
            Actions
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        >
          <DropdownMenuItem asChild className="gap-2">
            <Link href={`${base}/preview`}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href={`${base}/availability`}>
              <FileText className="h-3.5 w-3.5" />
              Availability
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href={`${base}/management`}>
              <Megaphone className="h-3.5 w-3.5" />
              Publishing
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            disabled={pending}
            onSelect={(event) => {
              event.preventDefault();
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-rose-400 focus:text-rose-400"
            disabled={pending || isArchived}
            onSelect={(event) => {
              event.preventDefault();
              setArchiveOpen(true);
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            {isArchived ? 'Archived' : 'Archive'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        className={workspaceBtnPrimaryMd}
        onClick={() => setEditOpen(true)}
      >
        <Edit2 className="h-4 w-4" />
        Edit
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {isOverview ? (
        <OverviewHeader
          listing={listing}
          address={address}
          headerActions={headerActions}
        />
      ) : (
        <CompactHeader
          listing={listing}
          address={address}
          headerActions={headerActions}
        />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active =
              item.href === '' ? isOverview : pathname.startsWith(href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                data-tour={
                  item.key === 'marketing'
                    ? 'sop-listing-marketing'
                    : item.key === 'media'
                      ? 'sop-listing-media'
                      : item.key === 'management'
                        ? 'sop-listing-portal'
                        : undefined
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <ListingFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        accountId={accountId}
        accountSlug={accountSlug}
        listing={listing}
        onSaved={(saved) => {
          setListing(saved);
          setEditOpen(false);
          router.refresh();
        }}
      />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this disposal?</AlertDialogTitle>
            <AlertDialogDescription>
              Sets status to Withdrawn and takes it off market. You can change
              the status again later from Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                onArchive();
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CompactHeader({
  listing,
  address,
  headerActions,
}: {
  listing: CommercialListing;
  address: string;
  headerActions: React.ReactNode;
}) {
  const updatedLabel = formatUpdatedAt(listing.updatedAt);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          {listing.name}
        </h2>
        {address ? (
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text)]/55">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{address}</span>
          </p>
        ) : null}
        {updatedLabel ? (
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            Updated {updatedLabel}
          </p>
        ) : null}
      </div>
      {headerActions}
    </div>
  );
}

function OverviewHeader({
  listing,
  address,
  headerActions,
}: {
  listing: CommercialListing;
  address: string;
  headerActions: React.ReactNode;
}) {
  const updatedLabel = formatUpdatedAt(listing.updatedAt);

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-[var(--workspace-shell-sidebar-accent)] sm:h-auto sm:w-52">
          {listing.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center text-[var(--workspace-shell-text)]/25">
              <Camera className="h-10 w-10" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded-md bg-[var(--ozer-accent)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--ozer-white)] uppercase">
            {LISTING_STATUS_LABELS[listing.status]}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
                {listing.name}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text)]/55">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{address || 'No address'}</span>
              </p>
            </div>
            {headerActions}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
            >
              {DISPOSAL_TYPE_LABELS[listing.disposalType]}
            </span>
            <ListingSectorPills sector={listing.sector} size="md" />
            {listing.sizeMinSqft != null || listing.sizeMaxSqft != null ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
                {[listing.sizeMinSqft, listing.sizeMaxSqft]
                  .filter((v) => v != null)
                  .join('–')}{' '}
                sq ft
              </span>
            ) : null}
          </div>
          {(listing.actingAgents?.length ?? 0) > 0 ? (
            <div className="flex items-center gap-2">
              <ListingAgentAvatarStack
                agents={listing.actingAgents ?? []}
                size="sm"
              />
              <span className="text-xs text-[var(--workspace-shell-text)]/50">
                {(listing.actingAgents ?? [])
                  .slice(0, 3)
                  .map((agent) => agent.name)
                  .join(', ')}
                {(listing.actingAgents?.length ?? 0) > 3
                  ? ` +${(listing.actingAgents?.length ?? 0) - 3}`
                  : ''}
              </span>
            </div>
          ) : null}
          {updatedLabel ? (
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              Updated {updatedLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
