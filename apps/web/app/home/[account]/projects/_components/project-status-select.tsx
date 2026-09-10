'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import {
  type ProjectStatus,
  fallbackProjectStatuses,
  projectStatusStyle,
} from '~/lib/projects/project-statuses';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

export function ProjectStatusSelect({
  value,
  onValueChange,
  statuses,
  className,
  triggerClassName,
  coloured = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  statuses?: readonly ProjectStatus[];
  className?: string;
  triggerClassName?: string;
  coloured?: boolean;
}) {
  const options = statuses?.length ? statuses : fallbackProjectStatuses();
  const current = options.some((status) => status.slug === value)
    ? value
    : (options[0]?.slug ?? value);
  const style = projectStatusStyle(current, options);

  return (
    <Select value={current} onValueChange={onValueChange}>
      <SelectTrigger
        className={triggerClassName}
        style={
          coloured
            ? { backgroundColor: style.bg, color: style.text }
            : undefined
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={className ?? workspaceSelectContentClass}>
        {options.map((status) => (
          <SelectItem
            key={status.id}
            value={status.slug}
            className={workspaceSelectItemClass}
          >
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
