'use client';

import { useContext, useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import { TeamAccountWorkspaceContext } from '@kit/team-accounts/components';
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

import {
  workspaceComboboxListClass,
  workspaceComboboxPopoverClass,
} from '~/components/workspace-shell/workspace-combobox-styles';

import type { TaskAssignmentOption } from '../../_lib/actions/task-actions';
import { groupProjectsByWorkspace } from '../../tasks/_lib/group-task-options';

type TaskAssignmentComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: TaskAssignmentOption[];
  isWorkspaceMode?: boolean;
  /** Team workspace display name — used for the “{name} only” option. */
  workspaceName?: string | null;
  placeholder?: string;
};

function workspaceOnlyLabel(workspaceName?: string | null) {
  const name = workspaceName?.trim();
  return name ? `${name} only` : 'Workspace only';
}

export function TaskAssignmentCombobox({
  value,
  onValueChange,
  options,
  isWorkspaceMode = false,
  workspaceName,
  placeholder,
}: TaskAssignmentComboboxProps) {
  const [open, setOpen] = useState(false);
  const teamWorkspace = useContext(TeamAccountWorkspaceContext);

  const resolvedWorkspaceName = useMemo(() => {
    if (workspaceName?.trim()) {
      return workspaceName.trim();
    }

    const fromOptions = options
      .find((option) => option.accountName?.trim())
      ?.accountName?.trim();
    if (fromOptions) {
      return fromOptions;
    }

    const contextName = teamWorkspace?.account?.name;
    return typeof contextName === 'string' ? contextName.trim() || null : null;
  }, [options, teamWorkspace?.account?.name, workspaceName]);

  const noneLabel = isWorkspaceMode
    ? workspaceOnlyLabel(resolvedWorkspaceName)
    : 'No assignment';

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
    placeholder ??
    (isWorkspaceMode ? noneLabel : 'No assignment');

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 w-full justify-between border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-normal text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
            !selected &&
              value === 'none' &&
              'text-[var(--workspace-shell-text-muted)]',
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={workspaceComboboxPopoverClass} align="start">
        <Command className="flex max-h-[inherit] flex-col overflow-hidden bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <CommandInput
            placeholder="Search projects and clients…"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          <CommandList
            className={workspaceComboboxListClass}
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No matches found.</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value={`${noneLabel} none unassigned`}
                onSelect={() => {
                  onValueChange('none');
                  setOpen(false);
                }}
                className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === 'none' ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {noneLabel}
              </CommandItem>
            </CommandGroup>

            {projectGroups.map((group) => (
              <CommandGroup
                key={group.key}
                heading={isWorkspaceMode ? 'Projects' : group.label}
              >
                {group.projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project ${project.name} ${group.label}`}
                    onSelect={() => {
                      onValueChange(project.id);
                      setOpen(false);
                    }}
                    className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
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
                      className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
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
                      className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
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
