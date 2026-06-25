'use client';

import { ClipboardList, Info, LayoutGrid } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  PROJECT_TYPE_META,
  type ProjectType,
} from '~/lib/projects/project-types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ProjectType) => void;
};

const ICONS = {
  delivery: ClipboardList,
  campaign: LayoutGrid,
} as const;

export function ProjectTypePickerDialog({ open, onOpenChange, onSelect }: Props) {
  const types: ProjectType[] = ['delivery', 'campaign'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/10 bg-[#0f172a] text-white">
        <DialogHeader>
          <DialogTitle>What kind of project?</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose the shape that fits your work. You can run both delivery and campaign
            trackers in the same workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((type) => {
            const meta = PROJECT_TYPE_META[type];
            const Icon = ICONS[meta.icon];

            return (
              <div
                key={type}
                className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--keel-teal)]/15 text-[#5eead4]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-zinc-300"
                          aria-label={`Examples for ${meta.label}`}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="max-w-xs border-white/10 bg-[#1e293b] text-zinc-200"
                      >
                        <p className="mb-1 text-xs font-medium text-white">Examples</p>
                        <ul className="list-disc space-y-1 pl-4 text-xs">
                          {meta.examples.map((example) => (
                            <li key={example}>{example}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-400">
                  {meta.description}
                </p>

                <Button
                  type="button"
                  className={cn('mt-4 w-full')}
                  onClick={() => {
                    onSelect(type);
                    onOpenChange(false);
                  }}
                >
                  Create {meta.shortLabel.toLowerCase()}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
