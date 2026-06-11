'use client';

import { useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import {
  adminApplyPlanLimitsAction,
  adminGrantEntitlementAction,
  adminRevokeEntitlementAction,
  adminSetBillingExemptAction,
} from '~/lib/billing/admin-grants.actions';

type EntitlementRow = {
  entitlement_key: string;
  source: string;
  expires_at: string | null;
};

const WORKSPACE_ENTITLEMENTS = [
  { key: 'workspace_community', label: 'Community workspace' },
  { key: 'workspace_business_lite', label: 'Business Lite (apps shell)' },
  { key: 'workspace_business', label: 'Business workspace' },
  { key: 'workspace_property', label: 'Property workspace' },
];

const ADDON_ENTITLEMENTS = [
  { key: 'addon_signatures', label: 'Signatures' },
  { key: 'addon_rankly', label: 'Rankly' },
  { key: 'addon_feedflow', label: 'Feedflow' },
  { key: 'addon_videos', label: 'Videos' },
];

const QUICK_PLANS = [
  {
    label: 'Business Team',
    productId: 'keel-business-team',
    planId: 'business-team-monthly',
  },
  {
    label: 'Property Starter',
    productId: 'keel-property-starter',
    planId: 'property-starter-monthly',
  },
  {
    label: 'Rankly add-on',
    productId: 'keel-addon-rankly',
    planId: 'rankly-monthly',
  },
];

export function AdminBillingGrantsPanel(props: {
  accountId: string;
  entitlements: EntitlementRow[];
  billingExempt: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const grant = (entitlementKey: string) => {
    startTransition(async () => {
      try {
        await adminGrantEntitlementAction({
          accountId: props.accountId,
          entitlementKey,
        });
        toast.success(`Granted ${entitlementKey}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Grant failed');
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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Revoke failed');
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
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    });
  };

  const applyPlan = (productId: string, planId: string) => {
    startTransition(async () => {
      try {
        await adminApplyPlanLimitsAction({
          accountId: props.accountId,
          productId,
          planId,
        });
        toast.success('Plan limits applied');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Apply failed');
      }
    });
  };

  const hasKey = (key: string) =>
    props.entitlements.some((e) => e.entitlement_key === key);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Billing & entitlements</CardTitle>
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
      <CardContent className="space-y-6">
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Quick plan presets
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PLANS.map((plan) => (
              <Button
                key={plan.planId}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => applyPlan(plan.productId, plan.planId)}
              >
                {plan.label}
              </Button>
            ))}
          </div>
        </div>

        <EntitlementGroup
          title="Workspace access"
          items={WORKSPACE_ENTITLEMENTS}
          hasKey={hasKey}
          pending={pending}
          onGrant={grant}
          onRevoke={revoke}
          entitlements={props.entitlements}
        />

        <EntitlementGroup
          title="Add-ons"
          items={ADDON_ENTITLEMENTS}
          hasKey={hasKey}
          pending={pending}
          onGrant={grant}
          onRevoke={revoke}
          entitlements={props.entitlements}
        />
      </CardContent>
    </Card>
  );
}

function EntitlementGroup({
  title,
  items,
  hasKey,
  pending,
  onGrant,
  onRevoke,
  entitlements,
}: {
  title: string;
  items: Array<{ key: string; label: string }>;
  hasKey: (key: string) => boolean;
  pending: boolean;
  onGrant: (key: string) => void;
  onRevoke: (key: string) => void;
  entitlements: EntitlementRow[];
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const active = hasKey(item.key);
          const row = entitlements.find((e) => e.entitlement_key === item.key);

          return (
            <li
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {row ? (
                  <p className="text-muted-foreground text-xs">
                    Source: {row.source}
                    {row.expires_at
                      ? ` · Expires ${new Date(row.expires_at).toLocaleDateString()}`
                      : ''}
                  </p>
                ) : null}
              </div>
              {active && row?.source === 'admin_grant' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onRevoke(item.key)}
                >
                  Revoke grant
                </Button>
              ) : active ? (
                <span className="text-muted-foreground text-xs">Active (Stripe)</span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => onGrant(item.key)}
                >
                  Grant
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
