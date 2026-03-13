import { cva } from 'class-variance-authority';

import { Badge } from '@kit/ui/badge';
import { Trans } from '@kit/ui/trans';

type Role = string;

const roles: Record<string, string> = {
  owner: '',
  admin: '',
  staff: 'bg-blue-50 hover:bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:hover:bg-blue-500/10',
  contractor:
    'bg-amber-50 hover:bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:hover:bg-amber-500/10',
  client: 'bg-muted hover:bg-muted text-muted-foreground',
};

const roleClassNameBuilder = cva('font-medium capitalize shadow-none', {
  variants: {
    role: roles,
  },
});

export function RoleBadge({ role }: { role: Role }) {
  const className = roleClassNameBuilder({ role });
  const isCustom = !(role in roles);

  return (
    <Badge className={className} variant={isCustom ? 'outline' : 'default'}>
      <span data-test={'member-role-badge'}>
        <Trans i18nKey={`common:roles.${role}.label`} defaults={role} />
      </span>
    </Badge>
  );
}
