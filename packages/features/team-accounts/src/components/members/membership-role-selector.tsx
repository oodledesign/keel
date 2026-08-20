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
  showDescriptions = true,
}: {
  roles: Role[];
  value: Role;
  currentUserRole?: Role;
  onChange: (role: Role) => unknown;
  triggerClassName?: string;
  contentClassName?: string;
  /** Show a short permission blurb under each role in the menu. */
  showDescriptions?: boolean;
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
        className={cn(
          showDescriptions ? 'min-w-[16rem]' : 'min-w-[8.5rem]',
          contentClassName,
        )}
      >
        {roles.map((role) => {
          return (
            <SelectItem
              key={role}
              data-test={`role-option-${role}`}
              disabled={currentUserRole === role}
              value={role}
              className={cn(!showDescriptions && 'capitalize')}
            >
              {showDescriptions ? (
                <div className="flex flex-col items-start gap-0.5 py-0.5 text-left">
                  <span className="capitalize">
                    <Trans
                      i18nKey={`common:roles.${role}.label`}
                      defaults={role}
                    />
                  </span>
                  <span className="text-muted-foreground text-xs font-normal whitespace-normal">
                    <Trans
                      i18nKey={`common:roles.${role}.description`}
                      defaults=""
                    />
                  </span>
                </div>
              ) : (
                <Trans i18nKey={`common:roles.${role}.label`} defaults={role} />
              )}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
