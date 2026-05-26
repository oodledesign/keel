import { Badge } from '@kit/ui/badge';

import type { SignatureStatus } from '../_lib/server/signatures-data';

export function SignaturesStatusBadge({ status }: { status: SignatureStatus }) {
  const classes = {
    pushed: 'border-[var(--keel-teal)]/40 bg-[var(--keel-teal)]/10 text-[var(--keel-teal)]',
    pending: 'border-[#F2C94C]/40 bg-[#F2C94C]/10 text-[#F2C94C]',
    error: 'border-[#E85D75]/40 bg-[#E85D75]/10 text-[#E85D75]',
  };

  return (
    <Badge variant="outline" className={classes[status]}>
      {status}
    </Badge>
  );
}
