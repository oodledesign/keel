'use client';

import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import type { TaskPersonAssigneeOption } from '~/lib/tasks/task-person-assignee';
import { personAssigneeSelectValue } from '~/lib/tasks/task-person-assignee';

type Props = {
  options: TaskPersonAssigneeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
};

export function TaskPersonAssigneeSelect({
  options,
  value,
  onChange,
  disabled,
  id = 'person-assignee',
  label = 'Assignee',
}: Props) {
  const members = options.filter((o) => o.kind === 'member');
  const contacts = options.filter((o) => o.kind === 'contact');

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs text-[var(--workspace-shell-text-muted)]"
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
        >
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned</SelectItem>
          {members.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Team</SelectLabel>
              {members.map((m) => (
                <SelectItem
                  key={m.id}
                  value={personAssigneeSelectValue({
                    kind: 'member',
                    userId: m.id,
                  })}
                >
                  {m.label}
                  {m.email ? ` (${m.email})` : ''}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {contacts.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Contacts</SelectLabel>
              {contacts.map((c) => (
                <SelectItem
                  key={c.id}
                  value={personAssigneeSelectValue({
                    kind: 'contact',
                    contactId: c.id,
                  })}
                >
                  {c.label}
                  {c.email ? ` (${c.email})` : ''}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
