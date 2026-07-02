'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@kit/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import type { TaskAssignmentOption } from '../../_lib/actions/task-actions';
import { groupProjectsByWorkspace } from '../../tasks/_lib/group-task-options';

type TaskAssignmentComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: TaskAssignmentOption[];
  isWorkspaceMode?: boolean;
  placeholder?: string;
};

export function TaskAssignmentCombobox({
  value,
  onValueChange,
  options,
  isWorkspaceMode = false,
  placeholder = 'Select project or client',
}: TaskAssignmentComboboxProps) {
  const [open, setOpen] = useState(false);

  const projects = useMemo(
    () => options.filter((option) => option.type === 'project'),
    [options],
  );
  const clients = useMemo(
    () =>
      options
        .filter((option) => option.type === 'client')
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
    [options],
  );
  const areas = useMemo(
    () => options.filter((option) => option.type === 'area'),
    [options],
  );
  const projectGroups = useMemo(
    () => groupProjectsByWorkspace(projects),
    [projects],
  );

  const selected = useMemo(() => {
    if (value === 'none') {
      return null;
    }

    return options.find((option) => option.id === value) ?? null;
  }, [options, value]);

  const displayLabel =
    selected?.name ??
    (isWorkspaceMode ? placeholder : 'No assignment');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 w-full justify-between border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-normal text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
            !selected && !isWorkspaceMode && value === 'none' && 'text-[var(--workspace-shell-text-muted)]',
            !selected && isWorkspaceMode && 'text-[var(--workspace-shell-text-muted)]',
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
        align="start"
      >
        <Command className="bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CommandInput
            placeholder="Search projects and clients…"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          <CommandList className="max-h-[min(50dvh,16rem)]">
            <CommandEmpty>No matches found.</CommandEmpty>

            {!isWorkspaceMode ? (
              <CommandGroup>
                <CommandItem
                  value="no assignment none"
                  onSelect={() => {
                    onValueChange('none');
                    setOpen(false);
                  }}
                  className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === 'none' ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  No assignment
                </CommandItem>
              </CommandGroup>
            ) : null}

            {projectGroups.map((group) => (
              <CommandGroup
                key={group.key}
                heading={
                  isWorkspaceMode ? 'Projects' : group.label
                }
              >
                {group.projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project ${project.name} ${group.label}`}
                    onSelect={() => {
                      onValueChange(project.id);
                      setOpen(false);
                    }}
                    className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)]"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === project.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex min-w-0 items-center gap-2">
                      {project.color ? (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                      ) : null}
                      <span className="truncate">{project.name}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {isWorkspaceMode && clients.length > 0 ? (
              <>
                {projectGroups.length > 0 ? (
                  <CommandSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
                ) : null}
                <CommandGroup heading="Clients">
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`client ${client.name}`}
                      onSelect={() => {
                        onValueChange(client.id);
                        setOpen(false);
                      }}
                      className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)]"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === client.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{client.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {!isWorkspaceMode && areas.length > 0 ? (
              <>
                {projectGroups.length > 0 ? (
                  <CommandSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
                ) : null}
                <CommandGroup heading="Life areas">
                  {areas.map((area) => (
                    <CommandItem
                      key={area.id}
                      value={`area ${area.name}`}
                      onSelect={() => {
                        onValueChange(area.id);
                        setOpen(false);
                      }}
                      className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)]"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === area.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex min-w-0 items-center gap-2">
                        {area.color ? (
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: area.color }}
                          />
                        ) : null}
                        <span className="truncate">{area.name}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
