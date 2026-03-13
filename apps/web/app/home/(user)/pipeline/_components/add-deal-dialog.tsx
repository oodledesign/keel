'use client';

import { useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

import { Plus, Loader2 } from 'lucide-react';

import { createDeal } from '../actions';
import type { PipelineDeal } from '../../_lib/server/pipeline.loader';

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
];

type Props = {
  businesses: Array<{ id: string; name: string; color: string | null }>;
  onDealCreated: (deal: PipelineDeal) => void;
};

export function AddDealDialog({ businesses, onDealCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState('lead');
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? '');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      const result = await createDeal({
        contactName,
        companyName,
        value,
        stage,
        nextAction: nextAction || undefined,
        nextActionDate: nextActionDate || undefined,
        businessId,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create deal');
        return;
      }

      const biz = businesses.find((b) => b.id === businessId);
      onDealCreated({
        id: result.id!,
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

      setOpen(false);
      setStage('lead');
      setBusinessId(businesses[0]?.id ?? '');
      formRef.current?.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#4ab86f]"
        >
          <Plus className="h-4 w-4" />
          Add Deal
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/8 bg-[#0F1923] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new deal</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a pipeline deal to start tracking a lead or opportunity.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-zinc-300">
                Contact name *
              </Label>
              <Input
                id="contactName"
                name="contactName"
                placeholder="Jane Smith"
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-zinc-300">
                Company
              </Label>
              <Input
                id="companyName"
                name="companyName"
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
            <Label htmlFor="value" className="text-zinc-300">
              Deal value (£)
            </Label>
            <Input
              id="value"
              name="value"
              type="number"
              min="0"
              step="1"
              placeholder="5000"
              className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nextAction" className="text-zinc-300">
                Short description / next action
              </Label>
              <Input
                id="nextAction"
                name="nextAction"
                placeholder="Short description for this deal"
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextActionDate" className="text-zinc-300">
                Action date
              </Label>
              <Input
                id="nextActionDate"
                name="nextActionDate"
                type="date"
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
              onClick={() => setOpen(false)}
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
                  Creating...
                </>
              ) : (
                'Create Deal'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
