'use client';

import Link from 'next/link';
import { useState } from 'react';

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
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

type WorkspaceNewMenuProps =
  | {
      variant: 'team';
      account: string;
      spaceType?: WorkspaceSpaceType;
    }
  | {
      variant: 'personal';
    };

export function WorkspaceNewMenu(props: WorkspaceNewMenuProps) {
  const [open, setOpen] = useState(false);

  const teamItems =
    props.variant === 'team'
      ? getTeamItems(props.account, props.spaceType ?? 'work')
      : [];
  const personalItems = props.variant === 'personal' ? getPersonalItems() : [];
  const items = props.variant === 'team' ? teamItems : personalItems;

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            'h-10 gap-1.5 rounded-lg border-0 px-4 text-sm font-semibold text-white shadow-none',
            'bg-gradient-to-r from-[#0B132B] to-[#2A9D8F] hover:from-[#0f1838] hover:to-[#34b3a4]',
          )}
        >
          <Plus className="h-4 w-4" />
          New
          <ChevronDown className="h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[12rem] border-white/10 bg-[#0F1B35] text-white"
      >
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild className="focus:bg-white/10">
            {item.href ? (
              <Link href={item.href} onClick={() => setOpen(false)}>
                <item.icon className="mr-2 h-4 w-4 text-[#2A9D8F]" />
                {item.label}
              </Link>
            ) : (
              <span className="flex items-center opacity-50">
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function accountPath(account: string, template: string) {
  return template.replace('[account]', account);
}

function getTeamItems(account: string, spaceType: WorkspaceSpaceType) {
  if (spaceType === 'community') {
    return [
      {
        key: 'task',
        label: 'New Task',
        icon: CheckSquare,
        href: `${accountPath(account, pathsConfig.app.accountCommunityTasks)}?create=task`,
      },
      {
        key: 'session',
        label: 'New Session',
        icon: Calendar,
        href: `${accountPath(account, pathsConfig.app.accountCommunitySchedule)}?create=session`,
      },
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}/new`,
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
        href: `${accountPath(account, pathsConfig.app.accountCommunityTasks)}?create=task`,
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
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}/new`,
      },
    ];
  }

  if (spaceType === 'property') {
    return [
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
        key: 'task',
        label: 'New Task',
        icon: CheckSquare,
        href: `${accountPath(account, pathsConfig.app.accountTasks)}?create=task`,
      },
      {
        key: 'doc',
        label: 'New Doc',
        icon: FileStack,
        href: `${accountPath(account, pathsConfig.app.accountDocs)}/new`,
      },
      {
        key: 'note',
        label: 'New Note',
        icon: StickyNote,
        href: `${accountPath(account, pathsConfig.app.accountNotes)}/new`,
      },
    ];
  }

  return [
    {
      key: 'project',
      label: 'New Project',
      icon: BriefcaseBusiness,
      href: `${accountPath(account, pathsConfig.app.accountJobs)}?create=job`,
    },
    {
      key: 'task',
      label: 'New Task',
      icon: CheckSquare,
      href: `${accountPath(account, pathsConfig.app.accountTasks)}?create=task`,
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
      key: 'deal',
      label: 'New Deal',
      icon: Kanban,
      href: `${accountPath(account, pathsConfig.app.accountPipeline)}?create=deal`,
    },
    {
      key: 'note',
      label: 'New Note',
      icon: StickyNote,
      href: `${accountPath(account, pathsConfig.app.accountNotes)}/new`,
    },
    {
      key: 'doc',
      label: 'New Doc',
      icon: FileStack,
      href: `${accountPath(account, pathsConfig.app.accountDocs)}/new`,
    },
  ];
}

function getPersonalItems() {
  return [
    {
      key: 'task',
      label: 'New Task',
      icon: CheckSquare,
      href: `${pathsConfig.app.home}/tasks?create=task`,
    },
    {
      key: 'planner',
      label: 'Plan My Day',
      icon: CalendarCheck2,
      href: pathsConfig.app.personalPlanner,
    },
    {
      key: 'note',
      label: 'New Note',
      icon: StickyNote,
      href: `${pathsConfig.app.home}/tasks?create=note`,
    },
  ];
}
