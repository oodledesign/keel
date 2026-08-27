'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

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

import { ListingStatusBadge } from '~/components/commercial/listing-status-badge';
import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import {
  archiveListing,
  duplicateListing,
} from '../_lib/server/server-actions';
import { DisposalAccessProvider } from './disposal-access-context';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import { ListingFormModal } from './listing-form-modal';
import { ListingPageSearch } from './listing-page-search';
import { ListingSectorPills } from './listing-sector-pills';

type NavKey =
  | 'overview'
  | 'marketing'
  | 'media'
  | 'interest'
  | 'availability'
  | 'management'
  | 'activity';

type NavSection = { id: string; label: string };

const NAV: Array<{
  key: NavKey;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  sections?: NavSection[];
}> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, href: '' },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    href: '/marketing',
    sections: [
      { id: 'summary-key-points', label: 'Summary' },
      { id: 'amenities', label: 'Amenities' },
      { id: 'marketing-text', label: 'Marketing text' },
      { id: 'accommodation', label: 'Accommodation' },
      { id: 'agent-contacts', label: 'Agents' },
      { id: 'publish-options', label: 'Publish' },
    ],
  },
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
    sections: [
      { id: 'marketing-readiness', label: 'Readiness' },
      { id: 'instruction', label: 'Instruction' },
      { id: 'assignment', label: 'Assignment' },
      { id: 'co-agents', label: 'Co-agents' },
      { id: 'parties', label: 'Parties' },
      { id: 'advanced-attrs', label: 'Attributes' },
      { id: 'private-media', label: 'Private media' },
      { id: 'publishing', label: 'Publishing' },
    ],
  },
  { key: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
];

const STICKY_OFFSET_CLASS = 'top-0';

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
  canEditDisposals,
  children,
}: {
  listing: CommercialListing;
  accountSlug: string;
  accountId: string;
  canEditDisposals: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [heroPinned, setHeroPinned] = useState(false);
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  const base = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id);

  const isOverview = pathname === base || pathname === `${base}/`;
  const activeNav =
    NAV.find((item) =>
      item.href === ''
        ? isOverview
        : pathname.startsWith(`${base}${item.href}`),
    ) ?? NAV[0]!;
  const activeSections = activeNav.sections ?? [];
  const address = listingAddress(listing);
  const isArchived = listing.status === 'withdrawn';
  const showStickyTitle = !isOverview || heroPinned;

  useEffect(() => {
    if (!isOverview) {
      setHeroPinned(true);
      return;
    }

    const node = heroSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setHeroPinned(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroPinned(!entry?.isIntersecting);
      },
      { rootMargin: '-8px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOverview]);

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
          {canEditDisposals ? (
            <>
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
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEditDisposals ? (
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={() => setEditOpen(true)}
        >
          <Edit2 className="h-4 w-4" />
          Edit
        </Button>
      ) : null}
    </div>
  );

  return (
    <DisposalAccessProvider canEditDisposals={canEditDisposals}>
      <div className="space-y-4">
        {!canEditDisposals ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-[var(--workspace-shell-text)]">
            View-only access — support seats can browse disposals but cannot
            edit, publish, or change settings.
          </div>
        ) : null}
      {isOverview ? (
        <>
          <div ref={heroSentinelRef} className="h-px w-full" aria-hidden />
          <OverviewHeader
            listing={listing}
            address={address}
            headerActions={headerActions}
          />
          <ListingPageSearch listingBasePath={base} className="max-w-lg" />
        </>
      ) : null}

      <div
        className={cn(
          'sticky top-0 z-20 -mx-1 space-y-3 px-1',
          showStickyTitle
            ? 'border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] pb-3'
            : 'border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] pb-3 lg:static lg:border-0 lg:bg-transparent lg:pb-0',
        )}
      >
        {showStickyTitle ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-[var(--workspace-shell-text)]">
                  {listing.name}
                </h2>
                <ListingStatusBadge status={listing.status} />
              </div>
              {address ? (
                <p className="mt-0.5 flex items-start gap-1.5 text-xs text-[var(--workspace-shell-text)]/55 sm:text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-1">{address}</span>
                </p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-md sm:items-end">
              <ListingPageSearch
                listingBasePath={base}
                className="w-full sm:w-72"
              />
              {headerActions}
            </div>
          </div>
        ) : null}

        {/* Mobile / tablet primary + section nav */}
        <div className="space-y-2 lg:hidden">
          <nav className="flex gap-1 overflow-x-auto pb-0.5">
            {NAV.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.key === activeNav.key;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={href}
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
          {activeSections.length > 0 ? (
            <nav className="flex gap-1 overflow-x-auto pb-0.5">
              {activeSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav
          className={cn(
            'hidden shrink-0 lg:sticky lg:flex lg:w-52 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible',
            STICKY_OFFSET_CLASS,
            showStickyTitle ? 'lg:top-[4.75rem]' : 'lg:top-3',
          )}
        >
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active = item.key === activeNav.key;
            const Icon = item.icon;
            return (
              <div key={item.key} className="space-y-0.5">
                <Link
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
                    'inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                      : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
                {active && item.sections?.length ? (
                  <div className="ml-3 space-y-0.5 border-l border-[color:var(--workspace-shell-border)] pl-2">
                    {item.sections.map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="block rounded-md px-2 py-1 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                      >
                        {section.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">{children}</div>
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
    </DisposalAccessProvider>
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
          <span className="absolute bottom-2 left-2">
            <ListingStatusBadge status={listing.status} />
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
