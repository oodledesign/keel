'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import {
  adminGrantEntitlementAction,
  adminRevokeEntitlementAction,
  adminSetBillingExemptAction,
} from '~/lib/billing/admin-grants.actions';
import { OZER_PERSONAL_ADDON_CATALOG } from '~/lib/billing/ozer-plan-catalog';

type EntitlementRow = {
  entitlement_key: string;
  source: string;
  expires_at: string | null;
};

export function AdminPersonalAddonsPanel(props: {
  accountId: string;
  entitlements: EntitlementRow[];
  billingExempt: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const emailAssistant = OZER_PERSONAL_ADDON_CATALOG[0]!;

  const hasKey = (key: string) =>
    props.entitlements.some((entry) => entry.entitlement_key === key);

  const grant = (entitlementKey: string) => {
    startTransition(async () => {
      try {
        await adminGrantEntitlementAction({
          accountId: props.accountId,
          entitlementKey,
        });
        toast.success(`Granted ${entitlementKey}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Grant failed');
      }
    });
  };

  const revoke = (entitlementKey: string) => {
    startTransition(async () => {
      try {
        await adminRevokeEntitlementAction({
          accountId: props.accountId,
          entitlementKey,
        });
        toast.success(`Revoked ${entitlementKey}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Revoke failed');
      }
    });
  };

  const toggleExempt = () => {
    startTransition(async () => {
      try {
        await adminSetBillingExemptAction({
          accountId: props.accountId,
          exempt: !props.billingExempt,
          reason: 'Super admin grant',
        });
        toast.success(
          props.billingExempt ? 'Billing exemption removed' : 'Billing exempt',
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Personal add-ons</CardTitle>
        <Button
          type="button"
          size="sm"
          variant={props.billingExempt ? 'destructive' : 'secondary'}
          disabled={pending}
          onClick={toggleExempt}
        >
          {props.billingExempt ? 'Remove billing exempt' : 'Mark billing exempt'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{emailAssistant.name}</p>
            <p className="text-muted-foreground text-sm">
              {emailAssistant.description}
            </p>
          </div>
          <div className="flex gap-2">
            {hasKey(emailAssistant.key) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => revoke(emailAssistant.key)}
              >
                Revoke
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => grant(emailAssistant.key)}
              >
                Grant
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
