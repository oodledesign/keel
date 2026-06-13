'use client';

import {
  ChevronDown,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

export function JobsPmToolbar({
  search,
  onSearchChange,
  canEditJobs,
  onNewProject,
  priorityFilter,
  onPriorityFilterChange,
  uiVariant,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  canEditJobs: boolean;
  onNewProject: () => void;
  priorityFilter: string | null;
  onPriorityFilterChange: (value: string | null) => void;
  uiVariant: 'projects' | 'maintenance';
}) {
  const newLabel =
    uiVariant === 'maintenance' ? 'New maintenance job' : 'New project';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-2.5 md:px-5">
      {canEditJobs && (
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-md bg-[#0073ea] px-3 text-xs font-semibold text-white hover:bg-[#0060c2]"
          onClick={onNewProject}
          data-test="create-job-button"
        >
          <Plus className="h-3.5 w-3.5" />
          {newLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      )}

      <div className="relative min-w-[180px] flex-1 max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={
            uiVariant === 'maintenance'
              ? 'Search maintenance jobs…'
              : 'Search projects…'
          }
          className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-white placeholder:text-zinc-500"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconButton icon={Users} label="Person" disabled />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white ${
                priorityFilter ? 'bg-white/10 text-white' : ''
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={() => onPriorityFilterChange(null)}>
              All priorities
            </DropdownMenuItem>
            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => onPriorityFilterChange(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
                {priorityFilter === p ? ' ✓' : ''}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarIconButton icon={SlidersHorizontal} label="Sort" disabled />
        <ToolbarIconButton icon={LayoutGrid} label="Hide" disabled />
      </div>
    </div>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  disabled,
}: {
  icon: typeof Search;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
