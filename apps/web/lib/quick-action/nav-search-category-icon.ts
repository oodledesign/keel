import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  StickyNote,
  UserRound,
} from 'lucide-react';

/**
 * Map quick-search category labels to nav-aligned icons + colours.
 * Dynamic entities use `"Workspace · Kind"` (e.g. `Bracketts · Disposal`).
 * Workspace nav pages use category = workspace name and `"Workspace — Page"` labels.
 */
export function resolveNavSearchCategoryVisual(
  category: string | undefined,
  options?: { label?: string },
): {
  Icon: LucideIcon;
  className: string;
} {
  const kind =
    extractCategoryKind(category) || extractKindFromLabel(options?.label);

  switch (kind) {
    case 'disposal':
    case 'disposals':
    case 'listing':
    case 'listings':
      return {
        Icon: Building2,
        className: 'text-[var(--ozer-accent)]',
      };
    case 'contact':
    case 'contacts':
    case 'client':
    case 'clients':
    case 'tenant':
    case 'tenants':
      return {
        Icon: UserRound,
        className: 'text-[var(--ozer-info)]',
      };
    case 'requirement':
    case 'requirements':
    case 'wip':
      return {
        Icon: ClipboardList,
        className: 'text-[var(--ozer-coral-600)]',
      };
    case 'project':
    case 'projects':
      return {
        Icon: CheckSquare,
        className: 'text-[var(--ozer-gold-500)]',
      };
    case 'meeting':
    case 'meetings':
      return {
        Icon: CalendarDays,
        className: 'text-[var(--ozer-plum-600,#6B4A58)]',
      };
    case 'rankly':
      return {
        Icon: LineChart,
        className: 'text-[var(--ozer-info)]',
      };
    case 'invoice':
    case 'invoices':
    case 'proposal':
    case 'proposals':
    case 'document':
    case 'docs':
      return {
        Icon: FileText,
        className: 'text-[var(--ozer-plum-600,#6B4A58)]',
      };
    case 'note':
    case 'notes':
      return {
        Icon: StickyNote,
        className: 'text-[var(--ozer-gold-500)]',
      };
    case 'personal':
    case 'dashboard':
      return {
        Icon: LayoutDashboard,
        className: 'text-[var(--workspace-shell-text-muted)]',
      };
    default:
      return {
        Icon: LayoutDashboard,
        className: 'text-[var(--workspace-shell-text-muted)]',
      };
  }
}

function extractCategoryKind(category: string | undefined): string {
  if (!category?.trim()) return '';
  const parts = category.split('·').map((part) => part.trim());
  // Only treat as a typed kind when "Workspace · Kind" is present.
  if (parts.length < 2) return '';
  return (parts.at(-1) ?? '').trim().toLowerCase();
}

function extractKindFromLabel(label: string | undefined): string {
  if (!label?.trim() || !label.includes('—')) return '';
  return (label.split('—').at(-1) ?? '').trim().toLowerCase();
}
