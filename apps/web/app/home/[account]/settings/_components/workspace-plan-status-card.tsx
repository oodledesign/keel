import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import type { AccountBillingStatus } from '~/lib/billing/account-billing-types';
import { isBillingRecoveryStatus } from '~/lib/billing/billing-recovery';

type WorkspacePlanStatusCardProps = {
  isBusinessLite: boolean;
  hasPaidSubscription: boolean;
  subscriptionProductPlan?: {
    product: { name: string };
    plan: { name: string };
  };
  canManageBilling: boolean;
  accountSlug: string;
  billingStatus?: AccountBillingStatus | null;
};

function statusBadge(status: AccountBillingStatus | null | undefined) {
  if (!status) return null;
  if (status === 'active' || status === 'trialing') {
    return <Badge variant="outline">Active</Badge>;
  }
  if (status === 'past_due_grace') {
    return <Badge variant="outline">Payment retrying</Badge>;
  }
  if (isBillingRecoveryStatus(status)) {
    return <Badge variant="destructive">Action needed</Badge>;
  }
  if (status === 'canceled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export function WorkspacePlanStatusCard({
  isBusinessLite,
  hasPaidSubscription,
  subscriptionProductPlan,
  canManageBilling,
  accountSlug,
  billingStatus,
}: WorkspacePlanStatusCardProps) {
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  if (isBusinessLite && !hasPaidSubscription) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Workspace plan</CardTitle>
              <CardDescription>
                Business Lite is free — enough to run Signatures and team
                settings. Upgrade when you need clients, projects, and invoicing.
              </CardDescription>
            </div>
            <Badge variant="outline">Business Lite</Badge>
          </div>
        </CardHeader>
        {canManageBilling ? (
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`${billingPath}?upgrade=1`}>Upgrade to full business</Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  if (hasPaidSubscription && subscriptionProductPlan) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Workspace plan</CardTitle>
              <CardDescription>
                {subscriptionProductPlan.product.name} ·{' '}
                {subscriptionProductPlan.plan.name}
              </CardDescription>
            </div>
            {statusBadge(billingStatus) ?? (
              <Badge variant="outline">Active</Badge>
            )}
          </div>
        </CardHeader>
      </Card>
    );
  }

  return null;
}
