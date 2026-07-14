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

import {
  attachHostingPlanAction,
  listPlanTemplatesAction,
} from '~/home/[account]/settings/services/_lib/server/plan-templates-actions';
import {
  type PlanTemplateRecord,
  formatMinorUnits,
} from '~/lib/billing/plan-templates-types';

export function AttachHostingPlanButton({
  accountId,
  websiteId,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<PlanTemplateRecord[]>([]);
  const [planTemplateId, setPlanTemplateId] = useState<string>('');
  const [createNew, setCreateNew] = useState(false);
  const [name, setName] = useState('Managed hosting');
  const [amountPounds, setAmountPounds] = useState('45');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    void listPlanTemplatesAction({
      accountId,
      kind: 'hosting',
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
        const result = await attachHostingPlanAction({
          accountId,
          websiteId,
          planTemplateId: createNew ? undefined : planTemplateId || undefined,
          newTemplate: createNew
            ? {
                kind: 'hosting',
                name,
                description: null,
                amount: Math.round(pounds * 100),
                currency: 'gbp',
                interval: 'month',
                active: true,
              }
            : undefined,
        });
        setCheckoutUrl(result.checkoutUrl);
        toast.success(
          'Hosting plan attached — send the payment link to your client',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not attach',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Add hosting plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add hosting plan</DialogTitle>
          <DialogDescription>
            Creates an incomplete Stripe subscription on your connected account.
            The client completes Checkout to activate. To change price later,
            cancel and create a new subscription (no prorations yet).
          </DialogDescription>
        </DialogHeader>

        {checkoutUrl ? (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--workspace-shell-text)]">
              Payment link ready. Copy and email it to the client, or they can
              open it from the portal once G3 is live.
            </p>
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
                New £45/mo plan
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
                    <SelectValue placeholder="Select hosting plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name} —{' '}
                        {formatMinorUnits(
                          row.amount,
                          row.currency,
                          row.interval,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {!checkoutUrl ? (
          <DialogFooter>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Create payment link
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
