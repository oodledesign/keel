'use client';

import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import type { SopTeamMember } from '~/lib/sops/types';

function memberLabel(member: SopTeamMember) {
  return member.name?.trim() || member.email?.trim() || 'Team member';
}

export function SopRunAssigneeSelect({
  id,
  label = 'Assigned to',
  members,
  value,
  disabled,
  onChange,
}: {
  id?: string;
  label?: string;
  members: SopTeamMember[];
  value: string | null;
  disabled?: boolean;
  onChange: (userId: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-zinc-500">
        {label}
      </Label>
      <Select
        value={value ?? '__unassigned__'}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(next === '__unassigned__' ? null : next)
        }
      >
        <SelectTrigger
          id={id}
          className="border-white/10 bg-black/20 text-white"
        >
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-[#1A2535] text-white">
          <SelectItem value="__unassigned__">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.user_id} value={member.user_id}>
              {memberLabel(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
