'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  BriefcaseBusiness,
  Clock3,
  FileText,
  Plus,
  UserRoundPlus,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';

import pathsConfig from '~/config/paths.config';

const items = [
  {
    key: 'job',
    title: 'New Job',
    description: 'Create a new project job',
    icon: BriefcaseBusiness,
    href: pathsConfig.app.accountJobs,
    tone: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
  },
  {
    key: 'invoice',
    title: 'Create Invoice',
    description: 'Generate new client invoice',
    icon: FileText,
    href: pathsConfig.app.accountInvoices,
    tone: 'from-blue-500/20 to-blue-500/5 text-blue-300',
  },
  {
    key: 'client',
    title: 'Add Client',
    description: 'Register new client account',
    icon: UserRoundPlus,
    href: pathsConfig.app.accountClients,
    tone: 'from-orange-500/20 to-orange-500/5 text-orange-300',
  },
  {
    key: 'time',
    title: 'Log Time',
    description: 'Record work hours',
    icon: Clock3,
    href: null,
    tone: 'from-violet-500/20 to-violet-500/5 text-violet-300',
  },
] as const;

export function TeamAccountQuickCreateMenu(props: { account: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="h-11 w-11 rounded-xl border border-emerald-400/40 bg-emerald-500 text-[#05120b] shadow-[0_10px_24px_rgba(5,46,22,0.55)] hover:bg-emerald-400"
        >
          <Plus className="h-5 w-5" />
          <span className="sr-only">Create new item</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[22rem] rounded-2xl border border-white/8 bg-[#1b2638]/98 p-3 text-white shadow-[0_18px_60px_rgba(2,8,23,0.55)] backdrop-blur-xl"
      >
        <div className="mb-3 px-1">
          <p className="text-sm font-semibold text-white">New Item</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <div className="flex min-h-[120px] flex-col rounded-2xl border border-white/7 bg-[#202c40]/90 p-4 transition hover:border-white/12 hover:bg-[#26344c]">
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs leading-5 text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </div>
            );

            if (!item.href) {
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled
                  className="text-left opacity-80"
                >
                  {content}
                </button>
              );
            }

            const href = `${item.href.replace('[account]', props.account)}?create=${item.key}`;

            return (
              <Link key={item.key} href={href} onClick={() => setOpen(false)}>
                {content}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
