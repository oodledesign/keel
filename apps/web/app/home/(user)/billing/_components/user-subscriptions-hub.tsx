'use client';

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

import type { UserSubscriptionHubRow } from '../_lib/server/user-subscriptions-hub.loader';

export function UserSubscriptionsHub({
  rows,
  stripePortalAction,
}: {
  rows: UserSubscriptionHubRow[];
  stripePortalAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>All subscriptions</CardTitle>
          <CardDescription>
            Each paid workspace has its own subscription. Add-ons (Rankly,
            Feedflow, Videos) bill separately per workspace. One Stripe customer
            — one card for everything.
          </CardDescription>
        </CardHeader>
        {stripePortalAction ? (
          <CardContent>{stripePortalAction}</CardContent>
        ) : null}
      </Card>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You do not manage any team workspaces yet. Create one from setup or
          accept an invite as owner.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.accountId}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.accountName}</p>
                    <Badge variant="outline">{row.workspaceLabel}</Badge>
                    {row.subscriptionStatus ? (
                      <Badge
                        variant={
                          row.subscriptionStatus === 'active' ||
                          row.subscriptionStatus === 'trialing' ||
                          row.subscriptionStatus === 'free'
                            ? 'outline'
                            : 'secondary'
                        }
                      >
                        {row.subscriptionStatus}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Unpaid</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {row.planLabel ? `Plan: ${row.planLabel}` : 'No plan yet'}
                    {row.addons.length > 0
                      ? ` · Add-ons: ${row.addons.join(', ')}`
                      : ''}
                  </p>
                  <p className="text-muted-foreground text-xs capitalize">
                    Your role: {row.role}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={row.billingPath}>Manage billing</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
