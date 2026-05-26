'use client';

import { useContext, useState } from 'react';

import { useRouter } from 'next/navigation';

import { CaretSortIcon } from '@radix-ui/react-icons';
import { CheckCircle, Plus } from 'lucide-react';

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
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

import { CreateTeamAccountDialog } from '@kit/team-accounts/components';

type WorkspaceAccountsSelectorProps = {
  selectedAccount: string;
  userId: string;
  accounts: WorkspaceSwitcherAccount[];
  className?: string;
  enableTeamCreation?: boolean;
};

export function WorkspaceAccountsSelector({
  selectedAccount,
  userId,
  accounts,
  className,
  enableTeamCreation = true,
}: WorkspaceAccountsSelectorProps) {
  const router = useRouter();
  const ctx = useContext(SidebarContext);
  const collapsed = !ctx?.open;
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selected = accounts.find((a) => a.value === selectedAccount);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-test="account-selector-trigger"
            size={collapsed ? 'icon' : 'default'}
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'group mr-1 w-full min-w-0 px-2 text-white hover:bg-white/[0.06] lg:w-auto lg:max-w-fit',
              collapsed ? 'm-auto justify-center px-2' : 'justify-start',
              className,
            )}
          >
            {selected ? (
              <span
                className={cn('flex max-w-full items-center', {
                  'gap-x-2': !collapsed,
                })}
              >
                <WorkspaceInitial
                  name={selected.label}
                  color={selected.accentColor}
                />
                {!collapsed ? (
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
            {!collapsed ? (
              <CaretSortIcon className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          data-test="account-selector-content"
          className="w-[min(100vw-2rem,320px)] border-white/10 bg-[#1A2535] p-0 text-white"
          align="start"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search workspaces…"
              className="h-9 border-white/10 text-white"
            />
            <CommandList>
              <CommandGroup heading="Your workspaces">
                {accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={`${account.label} ${account.slug} ${account.typeLabel}`}
                    className="my-1 cursor-pointer aria-selected:bg-white/10"
                    onSelect={() => {
                      setOpen(false);
                      router.replace(
                        pathsConfig.app.accountHome.replace(
                          '[account]',
                          account.slug,
                        ),
                      );
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <WorkspaceInitial
                        name={account.label}
                        color={account.accentColor}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {account.label}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {account.typeLabel}
                        </p>
                      </div>
                    </div>
                    {selectedAccount === account.value ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-[#57C87F]" />
                    ) : null}
                  </CommandItem>
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
        </PopoverContent>
      </Popover>

      {enableTeamCreation ? (
        <CreateTeamAccountDialog
          isOpen={isCreating}
          setIsOpen={setIsCreating}
          userId={userId}
        />
      ) : null}
    </>
  );
}

function WorkspaceInitial({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const letter = (name.trim()[0] ?? 'W').toUpperCase();
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
