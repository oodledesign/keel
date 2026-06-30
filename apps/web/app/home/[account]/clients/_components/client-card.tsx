'use client';

import Link from 'next/link';
import { ClipboardList, Mail, Phone } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

type ClientCardProps = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  city: string | null;
  picture_url?: string | null;
  updated_at: string;
  projectCount?: number;
  dueTaskCount?: number;
  selected: boolean;
  onSelect: () => void;
  detailHref?: string;
  onNotes?: () => void;
  onCall?: () => void;
  onEmail?: () => void;
};

function formatLastActivity(updatedAt: string): string {
  const d = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function ClientListTableHeader() {
  return (
    <thead>
      <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
        <th className="px-3 py-2 font-medium md:px-4">Client</th>
        <th className="hidden w-[120px] px-2 py-2 font-medium sm:table-cell">
          Last activity
        </th>
        <th className="w-[88px] px-2 py-2 text-right font-medium">Projects</th>
        <th className="w-[88px] px-2 py-2 text-right font-medium">Due tasks</th>
        <th className="w-[96px] px-2 py-2 md:pr-4" aria-label="Actions" />
      </tr>
    </thead>
  );
}

export function ClientCard({
  display_name,
  company_name,
  city,
  picture_url,
  updated_at,
  projectCount,
  dueTaskCount,
  selected,
  onSelect,
  detailHref,
  onNotes,
  onEmail,
  onCall,
}: ClientCardProps) {
  const subtitle = [company_name, city].filter(Boolean).join(' · ');

  const rowClassName = cn(
    'group border-b border-[color:var(--workspace-shell-border)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
    selected && 'bg-[var(--workspace-shell-panel-hover)]',
  );

  const nameCell = (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProfileAvatar
        displayName={display_name ?? 'Unnamed client'}
        pictureUrl={picture_url ?? null}
        className="h-7 w-7 shrink-0"
        fallbackClassName="bg-[var(--workspace-shell-panel-hover)] text-xs text-[var(--workspace-shell-text)]"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)] group-hover:text-[#579bfc]">
          {display_name ?? 'Unnamed client'}
        </p>
        {subtitle ? (
          <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );

  const actions = (
    <div className="flex shrink-0 justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
      {onNotes ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNotes();
          }}
          aria-label="Notes"
        >
          <ClipboardList className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {onCall ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCall();
          }}
          aria-label="Call"
        >
          <Phone className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {onEmail ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEmail();
          }}
          aria-label="Email"
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <tr className={rowClassName}>
      <td className="px-3 py-1.5 md:px-4">
        {detailHref ? (
          <Link href={detailHref} className="block min-w-0">
            {nameCell}
          </Link>
        ) : (
          <button type="button" onClick={onSelect} className="block min-w-0 text-left">
            {nameCell}
          </button>
        )}
      </td>
      <td className="hidden px-2 py-1.5 text-sm text-[var(--workspace-shell-text-muted)] sm:table-cell">
        {formatLastActivity(updated_at)}
      </td>
      <td className="px-2 py-1.5 text-right text-sm tabular-nums text-[var(--workspace-shell-text-muted)]">
        {projectCount ?? 0}
      </td>
      <td className="px-2 py-1.5 text-right text-sm tabular-nums text-[var(--workspace-shell-text-muted)]">
        {(dueTaskCount ?? 0) > 0 ? (
          <span className="text-amber-300/90">{dueTaskCount}</span>
        ) : (
          <span className="text-[var(--workspace-shell-text-muted)]">0</span>
        )}
      </td>
      <td className="px-2 py-1.5 md:pr-4">{actions}</td>
    </tr>
  );
}
