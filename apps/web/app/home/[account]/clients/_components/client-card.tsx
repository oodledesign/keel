'use client';

import Link from 'next/link';
import { ClipboardList, Mail, Phone, User } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

type ClientCardProps = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  city: string | null;
  updated_at: string;
  selected: boolean;
  onSelect: () => void;
  /** When set, the card links to the client detail page */
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
  if (diffDays === 0) return 'Last activity: Today';
  if (diffDays === 1) return 'Last activity: Yesterday';
  if (diffDays < 7) return `Last activity: ${diffDays} days ago`;
  if (diffDays < 30) return `Last activity: ${Math.floor(diffDays / 7)} weeks ago`;
  return `Last activity: ${Math.floor(diffDays / 30)} months ago`;
}

export function ClientCard({
  display_name,
  company_name,
  city,
  updated_at,
  selected,
  onSelect,
  detailHref,
  onNotes,
  onEmail,
  onCall,
}: ClientCardProps) {
  const location = [city, company_name].filter(Boolean).join(', ') || '—';

  const className = cn(
    'flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
    'border-zinc-700 bg-[var(--workspace-shell-panel)] hover:bg-[var(--workspace-shell-panel-hover)]',
    selected &&
      'border-emerald-500/50 bg-[var(--workspace-shell-panel-hover)] ring-2 ring-emerald-500/50',
  );

  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-400">
        <User className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">
          {display_name ?? 'Unnamed client'}
        </p>
        <p className="truncate text-sm text-zinc-400">{location}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatLastActivity(updated_at)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active
        </span>
      </div>
      <div className="flex shrink-0 gap-1">
        {onNotes && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onNotes();
            }}
            aria-label="Notes"
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        )}
        {onCall && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onCall();
            }}
            aria-label="Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
        )}
        {onEmail && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-700 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onEmail();
            }}
            aria-label="Email"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );

  if (detailHref) {
    return (
      <Link href={detailHref} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={className}>
      {content}
    </button>
  );
}
