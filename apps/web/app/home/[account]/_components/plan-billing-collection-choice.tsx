'use client';

import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';

import type { ClientSubscriptionBillingCollection } from '~/lib/billing/plan-templates-types';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

export function PlanBillingCollectionChoice({
  value,
  onChange,
}: {
  value: ClientSubscriptionBillingCollection;
  onChange: (value: ClientSubscriptionBillingCollection) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Billing</Label>
      <RadioGroup
        value={value}
        onValueChange={(next) =>
          onChange(next === 'offline' ? 'offline' : 'stripe')
        }
        className="grid gap-2"
        data-test="plan-billing-collection"
      >
        <RadioGroupItemLabel
          selected={value === 'stripe'}
          className="h-full items-start gap-3 space-x-0"
        >
          <RadioGroupItem value="stripe" className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className={`font-medium ${workspaceText}`}>
              Collect via Stripe
            </span>
            <span className={`text-xs ${workspaceTextMuted}`}>
              Create a payment link. The client pays in Stripe Checkout.
            </span>
          </span>
        </RadioGroupItemLabel>
        <RadioGroupItemLabel
          selected={value === 'offline'}
          className="h-full items-start gap-3 space-x-0"
        >
          <RadioGroupItem value="offline" className="mt-0.5" />
          <span className="grid gap-0.5">
            <span className={`font-medium ${workspaceText}`}>
              Activate now — billed offline
            </span>
            <span className={`text-xs ${workspaceTextMuted}`}>
              Mark the plan Active. You invoice the client outside Stripe — no
              collection and no payment link.
            </span>
          </span>
        </RadioGroupItemLabel>
      </RadioGroup>
    </div>
  );
}
