'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { PlanBillingCollectionChoice } from '~/home/[account]/_components/plan-billing-collection-choice';
import { notifyClientSubscriptionsChanged } from '~/home/[account]/_lib/client-subscriptions-events';
import {
  attachRetainerPlanAction,
  listPlanTemplatesAction,
} from '~/home/[account]/settings/services/_lib/server/plan-templates-actions';
import {
  type ClientSubscriptionBillingCollection,
  type PlanTemplateRecord,
  formatMinorUnits,
  planTemplateKindLabel,
} from '~/lib/billing/plan-templates-types';

export function AttachRetainerPlanButton({
  accountId,
  clientId,
  canEdit,
}: {
  accountId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<PlanTemplateRecord[]>([]);
  const [planTemplateId, setPlanTemplateId] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [name, setName] = useState('Monthly retainer');
  const [amountPounds, setAmountPounds] = useState('150');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [activatedOffline, setActivatedOffline] = useState(false);
  const [collection, setCollection] =
    useState<ClientSubscriptionBillingCollection>('stripe');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    void listPlanTemplatesAction({
      accountId,
      activeOnly: true,
    })
      .then((rows) => {
        setTemplates(rows);
        if (rows[0]?.id) setPlanTemplateId(rows[0].id);
      })
      .catch(() => setTemplates([]));
  }, [accountId, open]);

  if (!canEdit) return null;

  function submit() {
    startTransition(async () => {
      try {
        const pounds = Number(amountPounds);
        const result = await attachRetainerPlanAction({
          accountId,
          clientId,
          planTemplateId: createNew ? undefined : planTemplateId || undefined,
          newTemplate: createNew
            ? {
                kind: 'retainer',
                name,
                description: null,
                amount: Math.round(pounds * 100),
                currency: 'gbp',
                interval: 'month',
                active: true,
              }
            : undefined,
          collection,
        });
        notifyClientSubscriptionsChanged();
        if (result.checkoutUrl) {
          setCheckoutUrl(result.checkoutUrl);
          toast.success(
            'Retainer attached — send the payment link to your client',
          );
        } else {
          setActivatedOffline(true);
          toast.success(
            'Retainer activated — billed offline (no Stripe collection)',
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object' &&
                error &&
                'message' in error &&
                typeof (error as { message: unknown }).message === 'string'
              ? (error as { message: string }).message
              : 'Could not attach retainer';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCheckoutUrl(null);
          setActivatedOffline(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Add retainer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add retainer</DialogTitle>
          <DialogDescription>
            Attach any active Services plan (hosting, retainer, care plan, or
            custom). Collect via Stripe Checkout, or activate now if you invoice
            the client outside Stripe. To change amount later, cancel and create
            a new subscription — no upgrades or prorations in this version.
          </DialogDescription>
        </DialogHeader>

        {activatedOffline ? (
          <div className="space-y-2 text-sm text-[var(--workspace-shell-text)]">
            <p>This retainer is Active and billed offline.</p>
            <p className="text-[var(--workspace-shell-text-muted)]">
              No Stripe collection — invoice the client as you usually do.
            </p>
          </div>
        ) : checkoutUrl ? (
          <div className="space-y-3 text-sm">
            <p>Payment link ready for your client:</p>
            <Input readOnly value={checkoutUrl} />
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(checkoutUrl);
                toast.success('Link copied');
              }}
            >
              Copy link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={createNew ? 'outline' : 'default'}
                onClick={() => setCreateNew(false)}
              >
                Existing plan
              </Button>
              <Button
                type="button"
                size="sm"
                variant={createNew ? 'default' : 'outline'}
                onClick={() => setCreateNew(true)}
              >
                New plan
              </Button>
            </div>
            {createNew ? (
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (GBP / month)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPounds}
                    onChange={(e) => setAmountPounds(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select
                  value={planTemplateId}
                  onValueChange={setPlanTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No active plans in Services
                      </SelectItem>
                    ) : (
                      templates.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name} · {planTemplateKindLabel(row.kind)} —{' '}
                          {formatMinorUnits(
                            row.amount,
                            row.currency,
                            row.interval,
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <PlanBillingCollectionChoice
              value={collection}
              onChange={setCollection}
            />
          </div>
        )}

        {!checkoutUrl && !activatedOffline ? (
          <DialogFooter>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              {collection === 'offline'
                ? 'Activate now'
                : 'Create payment link'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
