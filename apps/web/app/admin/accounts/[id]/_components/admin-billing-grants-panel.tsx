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
  {
    key: 'workspace_commercial_property',
    label: 'Commercial Property workspace',
  },
];

const ADDON_ENTITLEMENTS = [
  { key: 'addon_signatures', label: 'Signatures' },
  { key: 'addon_site_studio', label: 'Site Studio' },
  { key: 'addon_rankly', label: 'Rankly' },
  { key: 'addon_feedflow', label: 'Feedflow' },
  { key: 'addon_videos', label: 'Videos' },
  { key: 'addon_media_generate', label: 'Media Generate' },
];

const QUICK_PLANS = [
  {
    label: 'Business Solo (1 seat)',
    productId: 'ozer-business',
    planId: 'business-monthly',
    billableSeats: 1,
  },
  {
    label: 'Business Team (4 seats)',
    productId: 'ozer-business',
    planId: 'business-monthly',
    billableSeats: 4,
  },
  {
    label: 'Business Scale (10 seats)',
    productId: 'ozer-business',
    planId: 'business-monthly',
    billableSeats: 10,
  },
  {
    label: 'Business Lite',
    productId: 'ozer-business-lite',
    planId: 'business-lite-free',
  },
  {
    label: 'Property Starter',
    productId: 'ozer-property-starter',
    planId: 'property-starter-monthly',
  },
  {
    label: 'Commercial Property (graduated)',
    productId: 'ozer-commercial-property',
    planId: 'commercial-property-monthly',
  },
  {
    label: 'Signatures Starter add-on',
    productId: 'ozer-addon-signatures',
    planId: 'signatures-starter-monthly',
  },
  {
    label: 'Site Studio add-on (dev)',
    productId: 'ozer-addon-site-studio',
    planId: 'site-studio-monthly',
  },
  {
    label: 'Rankly add-on',
    productId: 'ozer-addon-rankly',
    planId: 'rankly-monthly',
  },
  {
    label: 'Media Generate Starter',
    productId: 'ozer-addon-media-starter',
    planId: 'media-starter-monthly',
  },
  {
    label: 'Media Generate Studio',
    productId: 'ozer-addon-media-studio',
    planId: 'media-studio-monthly',
  },
  {
    label: 'Media Generate Agency',
    productId: 'ozer-addon-media-agency',
    planId: 'media-agency-monthly',
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

  const applyPlan = (
    productId: string,
    planId: string,
    billableSeats?: number,
  ) => {
    startTransition(async () => {
      try {
        const result = (await adminApplyPlanLimitsAction({
          accountId: props.accountId,
          productId,
          planId,
          billableSeats,
        })) as {
          success?: boolean;
          aiCreditsGranted?: number | null;
          mediaUnitsGranted?: number | null;
        };
        const parts = ['Plan limits applied'];
        if (result.aiCreditsGranted) {
          parts.push(`${result.aiCreditsGranted.toLocaleString()} AI credits`);
        }
        if (result.mediaUnitsGranted) {
          parts.push(
            `${result.mediaUnitsGranted.toLocaleString()} media units`,
          );
        }
        toast.success(parts.join(' · '));
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
          {props.billingExempt
            ? 'Remove billing exempt'
            : 'Mark billing exempt'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Presets set <strong>Business Solo / Team / Scale</strong> seat limits
          and refill the matching AI credit pool (Scale = 12,000). Media
          Generate Starter/Studio/Agency presets also grant monthly media units.
          Add-on <strong>Grant</strong> only unlocks the app — use a quick
          preset when you need usage tokens. Workspace type grants (Community /
          Lite / Property / Commercial Property) are different products — do not
          stack them to “upgrade” a Business plan.
        </p>
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Quick plan presets (tier limits)
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PLANS.map((plan) => (
              <Button
                key={plan.planId}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  applyPlan(
                    plan.productId,
                    plan.planId,
                    'billableSeats' in plan
                      ? (plan.billableSeats as number | undefined)
                      : undefined,
                  )
                }
              >
                {plan.label}
              </Button>
            ))}
          </div>
        </div>

        <EntitlementGroup
          title="Workspace type access (not Solo/Team/Scale)"
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
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
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
              {active && row?.source !== 'stripe' ? (
                <div className="flex flex-wrap gap-2">
                  {row?.source === 'admin_grant' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onGrant(item.key)}
                    >
                      Re-sync modules
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onRevoke(item.key)}
                  >
                    Revoke
                    {row?.source && row.source !== 'admin_grant'
                      ? ` (${row.source})`
                      : ' grant'}
                  </Button>
                </div>
              ) : active ? (
                <span className="text-muted-foreground text-xs">
                  Active (Stripe — manage via subscription)
                </span>
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
