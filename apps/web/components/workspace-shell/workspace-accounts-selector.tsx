'use client';

import { useContext, useState } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { CaretSortIcon } from '@radix-ui/react-icons';
import { CheckCircle, Mail, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@kit/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';
import { SidebarContext } from '@kit/ui/shadcn-sidebar';

import pathsConfig from '~/config/paths.config';
import {
  getWorkspaceFocusMutedClassName,
} from '~/components/workspace-shell/workspace-focus-sidebar-decorations';
import { useWorkspaceFocusSettings } from '~/components/workspace-shell/workspace-focus-context';
import { useWorkspaceFocusSnapshot } from '~/lib/hooks/use-workspace-focus';
import { FocusStatusBadge } from '~/home/[account]/settings/focus/_components/FocusStatusBadge';
import { holidayEmoji } from '~/home/[account]/settings/focus/_lib/focus-form';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';
import {
  isPersonalWorkspaceValue,
  PERSONAL_WORKSPACE_VALUE,
} from '~/lib/workspace-personal-switcher';

import { CreateTeamAccountDialog } from '@kit/team-accounts/components';

type WorkspaceAccountsSelectorProps = {
  selectedAccount: string;
  userId: string;
  accounts: WorkspaceSwitcherAccount[];
  className?: string;
  enableTeamCreation?: boolean;
  /** Popover (default) or inline expand — inline pushes sibling content down (mobile menu). */
  variant?: 'popover' | 'inline';
  onNavigate?: () => void;
};

export function WorkspaceAccountsSelector({
  selectedAccount,
  userId,
  accounts,
  className,
  enableTeamCreation = true,
  variant = 'popover',
  onNavigate,
}: WorkspaceAccountsSelectorProps) {
  const router = useRouter();
  const ctx = useContext(SidebarContext);
  const collapsed = !ctx?.open;
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selected = accounts.find((a) => a.value === selectedAccount);

  function navigateTo(account: WorkspaceSwitcherAccount) {
    setOpen(false);
    onNavigate?.();

    if (isPersonalWorkspaceValue(account.value)) {
      router.replace(getExplicitPersonalHomePath());
      return;
    }

    router.replace(
      pathsConfig.app.accountHome.replace('[account]', account.slug),
    );
  }

  const trigger = (
    <Button
      data-test="account-selector-trigger"
      size={collapsed && variant === 'popover' ? 'icon' : 'default'}
      variant="ghost"
      role="combobox"
      aria-expanded={open}
      type="button"
      onClick={variant === 'inline' ? () => setOpen((v) => !v) : undefined}
      className={cn(
        'group mr-1 w-full min-w-0 px-2 text-white hover:bg-white/[0.06] lg:w-auto lg:max-w-fit',
        collapsed && variant === 'popover' ? 'm-auto justify-center px-2' : 'justify-start',
        className,
      )}
    >
      {selected ? (
        <span
          className={cn('flex max-w-full items-center', {
            'gap-x-2': !collapsed || variant === 'inline',
          })}
        >
          <WorkspaceAvatar
            name={selected.label}
            color={selected.accentColor}
            image={selected.image}
          />
          {!collapsed || variant === 'inline' ? (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">
                {selected.label}
              </span>
              <span className="block truncate text-[11px] text-zinc-500">
                {selected.typeLabel}
              </span>
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-sm text-zinc-400">Workspace</span>
      )}
      {!collapsed || variant === 'inline' ? (
        <CaretSortIcon className="ml-1 h-4 w-4 shrink-0 opacity-50" />
      ) : null}
    </Button>
  );

  const list = (
    <Command className="bg-transparent">
      <CommandInput
        placeholder="Search workspaces…"
        className="h-9 border-white/10 text-white"
      />
      <CommandList className="max-h-[min(50dvh,var(--radix-popover-content-available-height,50dvh))]">
        <CommandGroup heading="Your workspaces">
          {accounts.map((account) => (
            <WorkspaceSwitcherAccountRow
              key={account.id}
              account={account}
              selectedAccount={selectedAccount}
              onSelect={() => navigateTo(account)}
            />
          ))}
        </CommandGroup>

        {enableTeamCreation ? (
          <>
            <CommandSeparator className="bg-white/10" />
            <CommandGroup>
              <CommandItem
                className="cursor-pointer aria-selected:bg-white/10"
                onSelect={() => {
                  setOpen(false);
                  setIsCreating(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4 text-[#2A9D8F]" />
                Create new workspace
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </Command>
  );

  return (
    <>
      {variant === 'inline' ? (
        <div className="w-full">
          {trigger}
          {open ? (
            <div className="mt-2 max-h-[min(50dvh,20rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#141c2e]">
              {list}
            </div>
          ) : null}
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            data-test="account-selector-content"
            className="z-[200] w-[min(100vw-2rem,320px)] border-white/10 bg-[#1A2535] p-0 text-white"
            align="start"
          >
            {list}
          </PopoverContent>
        </Popover>
      )}

      {enableTeamCreation ? (
        <CreateTeamAccountDialog
          isOpen={isCreating}
          setIsOpen={setIsCreating}
        />
      ) : null}
    </>
  );
}

export function buildPersonalSwitcherAccounts(
  accounts: WorkspaceSwitcherAccount[],
): WorkspaceSwitcherAccount[] {
  const personal: WorkspaceSwitcherAccount = {
    id: PERSONAL_WORKSPACE_VALUE,
    label: 'Personal',
    slug: PERSONAL_WORKSPACE_VALUE,
    value: PERSONAL_WORKSPACE_VALUE,
    image: null,
    profile: 'work_design',
    typeLabel: 'Life',
    accentColor: '#2A9D8F',
    createdAt: '',
  };

  return [personal, ...accounts];
}

function WorkspaceAvatar({
  name,
  color,
  image,
}: {
  name: string;
  color: string;
  image: string | null;
}) {
  const letter = (name.trim()[0] ?? 'W').toUpperCase();

  if (image) {
    return (
      <span className="relative flex h-7 w-7 shrink-0 overflow-hidden rounded-md">
        <Image src={image} alt="" fill className="object-cover" sizes="28px" />
      </span>
    );
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** @deprecated use WorkspaceAvatar */
function WorkspaceInitial({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return <WorkspaceAvatar name={name} color={color} image={null} />;
}

export { WorkspaceInitial };

function WorkspaceSwitcherAccountRow({
  account,
  selectedAccount,
  onSelect,
}: {
  account: WorkspaceSwitcherAccount;
  selectedAccount: string;
  onSelect: () => void;
}) {
  const isPersonal = isPersonalWorkspaceValue(account.value);
  const focusSettings = useWorkspaceFocusSettings(isPersonal ? null : account.id);
  const focusState = useWorkspaceFocusSnapshot(focusSettings);

  return (
    <CommandItem
      value={`${account.label} ${account.slug} ${account.typeLabel}`}
      className={cn(
        'my-1 cursor-pointer aria-selected:bg-white/10',
        getWorkspaceFocusMutedClassName(focusSettings),
      )}
      onSelect={onSelect}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <WorkspaceAvatar
          name={account.label}
          color={account.accentColor}
          image={account.image}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{account.label}</p>
            {!isPersonal && focusState.isWorkspaceSilenced ? (
              <FocusStatusBadge settings={focusSettings} compact />
            ) : null}
          </div>
          {!isPersonal && focusSettings ? (
            <div className="mt-0.5 space-y-0.5">
              {focusState.isHolidayModeActive ? (
                <p className="truncate text-[11px] text-zinc-500">
                  {holidayEmoji(focusSettings.holiday_mode_label)}{' '}
                  {focusSettings.holiday_mode_label}
                </p>
              ) : (
                <p className="truncate text-[11px] text-zinc-500">
                  {account.typeLabel}
                </p>
              )}
              {focusState.isOOOActive &&
              !focusState.isHolidayModeActive &&
              !focusState.isWorkspaceSilenced ? (
                <p className="inline-flex items-center gap-1 text-[11px] text-sky-300/90">
                  <Mail className="h-3 w-3" aria-hidden />
                  OOO
                </p>
              ) : null}
            </div>
          ) : (
            <p className="truncate text-[11px] text-zinc-500">
              {account.typeLabel}
            </p>
          )}
        </div>
      </div>
      {selectedAccount === account.value ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-[#57C87F]" />
      ) : null}
    </CommandItem>
  );
}
