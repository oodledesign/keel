'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

import { Loader2 } from 'lucide-react';

import { updateDeal } from '../actions';
import type { PipelineDeal } from '../../_lib/server/pipeline.loader';

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

type Props = {
  deal: PipelineDeal | null;
  businesses: Array<{ id: string; name: string; color: string | null }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: (deal: PipelineDeal) => void;
};

export function EditDealDialog({
  deal,
  businesses,
  open,
  onOpenChange,
  onDealUpdated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState(deal?.stage ?? 'lead');
  const [businessId, setBusinessId] = useState(deal?.businessId ?? businesses[0]?.id ?? '');

  useEffect(() => {
    if (deal && open) {
      setStage(deal.stage);
      setBusinessId((deal.businessId || businesses[0]?.id) ?? '');
      setError(null);
    }
  }, [deal, open, businesses]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deal) return;
    setError(null);
    const form = new FormData(e.currentTarget);

    const contactName = (form.get('contactName') as string).trim();
    const companyName = (form.get('companyName') as string).trim();
    const valueStr = (form.get('value') as string).trim();
    const nextAction = (form.get('nextAction') as string).trim();
    const nextActionDate = (form.get('nextActionDate') as string).trim();

    if (!contactName) {
      setError('Contact name is required');
      return;
    }
    if (!businessId) {
      setError('Please select a business');
      return;
    }

    const value = valueStr ? Math.round(parseFloat(valueStr)) : 0;

    startTransition(async () => {
      const result = await updateDeal(deal.id, {
        contactName,
        companyName,
        value,
        stage,
        nextAction: nextAction || undefined,
        nextActionDate: nextActionDate || undefined,
        businessId,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to update deal');
        return;
      }

      const biz = businesses.find((b) => b.id === businessId);
      onDealUpdated({
        ...deal,
        contactName,
        companyName,
        value,
        stage,
        nextAction,
        nextActionDate: nextActionDate || null,
        businessId,
        businessName: biz?.name ?? '',
        businessColor: biz?.color ?? null,
      });

      onOpenChange(false);
    });
  }

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/8 bg-[#0F1923] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit deal</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update contact, value, stage, and next action.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-contactName" className="text-zinc-300">
                Contact name *
              </Label>
              <Input
                id="edit-contactName"
                name="contactName"
                defaultValue={deal.contactName}
                placeholder="Jane Smith"
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-companyName" className="text-zinc-300">
                Company
              </Label>
              <Input
                id="edit-companyName"
                name="companyName"
                defaultValue={deal.companyName}
                placeholder="Acme Ltd"
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Business *</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  {businesses.map((biz) => (
                    <SelectItem key={biz.id} value={biz.id}>
                      <span className="flex items-center gap-2">
                        {biz.color && (
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: biz.color }}
                          />
                        )}
                        {biz.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-value" className="text-zinc-300">
              Deal value (£)
            </Label>
            <Input
              id="edit-value"
              name="value"
              type="number"
              min="0"
              step="1"
              defaultValue={deal.value}
              placeholder="5000"
              className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nextAction" className="text-zinc-300">
                Short description / next action
              </Label>
              <Input
                id="edit-nextAction"
                name="nextAction"
                defaultValue={deal.nextAction}
                placeholder="Short description for this deal"
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nextActionDate" className="text-zinc-300">
                Action date
              </Label>
              <Input
                id="edit-nextActionDate"
                name="nextActionDate"
                type="date"
                defaultValue={deal.nextActionDate ?? ''}
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4ab86f] disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
