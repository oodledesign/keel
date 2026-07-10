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

type WorkspacePlanStatusCardProps = {
  isBusinessLite: boolean;
  hasPaidSubscription: boolean;
  subscriptionProductPlan?: {
    product: { name: string };
    plan: { name: string };
  };
  canManageBilling: boolean;
  accountSlug: string;
};

export function WorkspacePlanStatusCard({
  isBusinessLite,
  hasPaidSubscription,
  subscriptionProductPlan,
  canManageBilling,
  accountSlug,
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
            <Badge variant="outline">Active</Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return null;
}
