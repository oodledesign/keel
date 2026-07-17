'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarCheck2,
  CheckSquare,
  ChevronDown,
  FileStack,
  FileText,
  Kanban,
  Plus,
  ShoppingCart,
  StickyNote,
  UserRoundPlus,
  UtensilsCrossed,
  Wrench,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import { HapticButton, HapticLink } from '~/components/haptic-link';
import { openWorkspaceCreateTaskDialog } from '~/components/workspace-shell/workspace-create-task-host';
import pathsConfig from '~/config/paths.config';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';
import { MOBILE_FLOATING_CHROME_ABOVE } from '~/lib/mobile-nav/mobile-floating-chrome';

type WorkspaceNewMenuProps =
  | {
      variant: 'team';
      account: string;
      spaceType?: WorkspaceSpaceType;
    }
  | {
      variant: 'personal';
    };

type NewMenuItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: 'create-task';
};

const MOBILE_NEW_MENU_ROW_CLASS =
  'flex min-h-[3.25rem] w-full items-center gap-4 rounded-xl px-4 py-3 text-[1.05rem] font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-white/6';

const DESKTOP_NEW_MENU_CONTENT_CLASS =
  'w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] shadow-[0_16px_48px_rgba(53,30,40,0.18)] outline-none ring-0 focus:outline-none focus-visible:outline-none dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]';

const DESKTOP_NEW_MENU_ITEM_CLASS =
  'rounded-xl p-0 outline-none ring-0 focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)] data-[highlighted]:bg-[var(--workspace-shell-sidebar-accent)] data-[highlighted]:text-[var(--workspace-shell-text)]';

const DESKTOP_NEW_MENU_ROW_CLASS =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]';

function getNewMenuItems(props: WorkspaceNewMenuProps) {
  const items =
    props.variant === 'team'
      ? getTeamItems(props.account, props.spaceType ?? 'work')
      : getPersonalItems();

  return prioritizeNewMenuItems(items);
}

/** Task and note first; preserve relative order of everything else. */
function prioritizeNewMenuItems(items: NewMenuItem[]): NewMenuItem[] {
  const task = items.find((item) => item.key === 'task');
  const note = items.find((item) => item.key === 'note');
  const rest = items.filter(
    (item) => item.key !== 'task' && item.key !== 'note',
  );

  return [task, note, ...rest].filter(Boolean) as NewMenuItem[];
}

function NewMenuItemRow({
  item,
  onNavigate,
  variant = 'dropdown',
}: {
  item: NewMenuItem;
  onNavigate: () => void;
  variant?: 'dropdown' | 'mobile' | 'panel';
}) {
  const iconClassName =
    variant === 'mobile'
      ? 'h-5 w-5 shrink-0 text-[var(--ozer-accent)]'
      : 'h-4 w-4 shrink-0 text-[var(--ozer-accent)]';

  if (item.action === 'create-task') {
    const className =
      variant === 'mobile'
        ? MOBILE_NEW_MENU_ROW_CLASS
        : variant === 'panel'
          ? DESKTOP_NEW_MENU_ROW_CLASS
          : 'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-[var(--workspace-shell-sidebar-accent)]';

    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          onNavigate();
          openWorkspaceCreateTaskDialog();
        }}
      >
        <item.icon className={iconClassName} />
        {item.label}
      </button>
    );
  }

  if (item.href) {
    if (variant === 'mobile') {
      return (
        <HapticLink
          href={item.href}
          onClick={onNavigate}
          className={MOBILE_NEW_MENU_ROW_CLASS}
        >
          <item.icon className={iconClassName} />
          {item.label}
        </HapticLink>
      );
    }

    if (variant === 'panel') {
      return (
        <Link
          href={item.href}
          onClick={onNavigate}
          className={DESKTOP_NEW_MENU_ROW_CLASS}
        >
          <item.icon className={iconClassName} />
          {item.label}
        </Link>
      );
    }

    return (
      <Link href={item.href} onClick={onNavigate} className="flex items-center">
        <item.icon className={iconClassName} />
        {item.label}
      </Link>
    );
  }

  return (
    <span
      className={cn(
        'flex items-center opacity-50',
        variant === 'mobile' && MOBILE_NEW_MENU_ROW_CLASS,
      )}
    >
      <item.icon className={iconClassName} />
      {item.label}
    </span>
  );
}

export function WorkspaceNewMenu(props: WorkspaceNewMenuProps) {
  const [open, setOpen] = useState(false);
  const items = getNewMenuItems(props);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            'ozer-gradient-btn h-8 gap-1 rounded-md border-0 px-2.5 text-xs font-semibold shadow-none',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New
          <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={DESKTOP_NEW_MENU_CONTENT_CLASS}
      >
        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Create
          </p>
        </div>

        <nav className="max-h-[min(52vh,22rem)] overflow-y-auto px-1.5 py-1.5">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.key}>
                <DropdownMenuItem
                  asChild
                  className={DESKTOP_NEW_MENU_ITEM_CLASS}
                >
                  <NewMenuItemRow
                    item={item}
                    variant="panel"
                    onNavigate={() => setOpen(false)}
                  />
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        </nav>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact “New” control for the mobile bottom nav bar. */
export function WorkspaceMobileNewMenu(props: WorkspaceNewMenuProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const items = getNewMenuItems(props);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    const timer = window.setTimeout(() => setVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <HapticButton
        type="button"
        aria-label="Create new"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] shadow-sm hover:bg-[var(--ozer-accent-hover)]"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-[21px] w-[21px]" />
      </HapticButton>

      {visible ? (
        <>
          <div
            className={cn(
              'fixed inset-0 z-[105] bg-[#060a12]/72 backdrop-blur-md transition-opacity duration-200 lg:hidden',
              open ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
            onClick={close}
          />

          <div
            className={cn(
              'fixed inset-x-3 z-[106] transition-all duration-200 ease-out lg:hidden',
              MOBILE_FLOATING_CHROME_ABOVE,
              open
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-3 opacity-0',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Create menu"
            aria-hidden={!open}
          >
            <div className="overflow-hidden rounded-[1.25rem] border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
                <p className="text-base font-semibold text-[var(--workspace-shell-text)]">
                  Create
                </p>
                <HapticButton
                  type="button"
                  aria-label="Close create menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--workspace-shell-text-muted)] hover:bg-white/8 hover:text-[var(--workspace-shell-text)]"
                  onClick={close}
                >
                  <X className="h-5 w-5" />
                </HapticButton>
              </div>

              <nav className="max-h-[min(52vh,22rem)] overflow-y-auto px-2 py-2">
                <ul className="flex flex-col gap-1">
                  {items.map((item, index) => (
                    <li
                      key={item.key}
                      className={cn(
                        'transition-all duration-200',
                        open
                          ? 'translate-y-0 opacity-100'
                          : 'translate-y-1 opacity-0',
                      )}
                      style={{
                        transitionDelay: open ? `${index * 30}ms` : '0ms',
                      }}
                    >
                      <NewMenuItemRow
                        item={item}
                        variant="mobile"
                        onNavigate={close}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function accountPath(account: string, template: string) {
  return template.replace('[account]', account);
}

function getTeamItems(
  account: string,
  spaceType: WorkspaceSpaceType,
): NewMenuItem[] {
  if (spaceType === 'community') {
    return [
      {
        key: 'task',
        label: 'New Task',
        icon: CheckSquare,
        action: 'create-task',
      },
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}?new=1`,
      },
      {
        key: 'session',
        label: 'New Session',
        icon: Calendar,
        href: `${accountPath(account, pathsConfig.app.accountCommunitySchedule)}?create=session`,
      },
      {
        key: 'invite',
        label: 'Invite Member',
        icon: UserRoundPlus,
        href: accountPath(account, pathsConfig.app.accountMembers),
      },
    ];
  }

  if (spaceType === 'family') {
    return [
      {
        key: 'task',
        label: 'New Task',
        icon: CheckSquare,
        action: 'create-task',
      },
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}?new=1`,
      },
      {
        key: 'event',
        label: 'New Event',
        icon: Calendar,
        href: `${accountPath(account, pathsConfig.app.accountFamilyCalendar)}?create=event`,
      },
      {
        key: 'meal',
        label: 'Add to Meal Plan',
        icon: UtensilsCrossed,
        href: `${accountPath(account, pathsConfig.app.accountMealPlan)}?create=meal`,
      },
      {
        key: 'shopping',
        label: 'Add to Shopping List',
        icon: ShoppingCart,
        href: `${accountPath(account, pathsConfig.app.accountShopping)}?create=item`,
      },
    ];
  }

  if (spaceType === 'property') {
    return [
      {
        key: 'task',
        label: 'New Task',
        icon: CheckSquare,
        action: 'create-task',
      },
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}?new=1`,
      },
      {
        key: 'property',
        label: 'New Property',
        icon: Building2,
        href: `${accountPath(account, pathsConfig.app.accountProperties)}?create=property`,
      },
      {
        key: 'tenant',
        label: 'New Tenant',
        icon: UserRoundPlus,
        href: `${accountPath(account, pathsConfig.app.accountClients)}?create=client`,
      },
      {
        key: 'maintenance',
        label: 'New Maintenance Job',
        icon: Wrench,
        href: `${accountPath(account, pathsConfig.app.accountJobs)}?create=job`,
      },
      {
        key: 'file',
        label: 'Upload file',
        icon: FileStack,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}?upload=1`,
      },
    ];
  }

  return [
    {
      key: 'task',
      label: 'New Task',
      icon: CheckSquare,
      action: 'create-task',
    },
    {
      key: 'note',
      label: 'New Note',
      icon: StickyNote,
      href: `${accountPath(account, pathsConfig.app.accountNotes)}?new=1`,
    },
    {
      key: 'project',
      label: 'New Project',
      icon: BriefcaseBusiness,
      href: `${accountPath(account, pathsConfig.app.accountJobs)}?create=job`,
    },
    {
      key: 'client',
      label: 'New Client',
      icon: UserRoundPlus,
      href: `${accountPath(account, pathsConfig.app.accountClients)}?create=client`,
    },
    {
      key: 'invoice',
      label: 'New Invoice',
      icon: FileText,
      href: `${accountPath(account, pathsConfig.app.accountInvoices)}?create=invoice`,
    },
    {
      key: 'lead',
      label: 'New lead',
      icon: Kanban,
      href: `${accountPath(account, pathsConfig.app.accountPipeline)}?create=lead`,
    },
    {
      key: 'file',
      label: 'Upload file',
      icon: FileStack,
      href: `${accountPath(account, pathsConfig.app.accountNotes)}?upload=1`,
    },
  ];
}

function getPersonalItems(): NewMenuItem[] {
  return [
    {
      key: 'task',
      label: 'New Task',
      icon: CheckSquare,
      href: `${pathsConfig.app.home}/tasks?create=task`,
    },
    {
      key: 'note',
      label: 'New Note',
      icon: StickyNote,
      href: `${pathsConfig.app.home}/tasks?create=note`,
    },
    {
      key: 'person',
      label: 'Add person',
      icon: UserRoundPlus,
      href: `${pathsConfig.app.personalPeople}?create=person`,
    },
    {
      key: 'planner',
      label: 'Plan My Day',
      icon: CalendarCheck2,
      href: pathsConfig.app.personalPlanner,
    },
  ];
}
