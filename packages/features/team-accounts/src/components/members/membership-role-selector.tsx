import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

type Role = string;

export function MembershipRoleSelector({
  roles,
  value,
  currentUserRole,
  onChange,
  triggerClassName,
  contentClassName,
}: {
  roles: Role[];
  value: Role;
  currentUserRole?: Role;
  onChange: (role: Role) => unknown;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn('min-w-[8.5rem]', triggerClassName)}
        data-test={'role-selector-trigger'}
      >
        <SelectValue placeholder="Role" />
      </SelectTrigger>

      <SelectContent
        position="popper"
        className={cn('min-w-[8.5rem]', contentClassName)}
      >
        {roles.map((role) => {
          return (
            <SelectItem
              key={role}
              data-test={`role-option-${role}`}
              disabled={currentUserRole === role}
              value={role}
              className="capitalize"
            >
              <Trans i18nKey={`common:roles.${role}.label`} defaults={role} />
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
