'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

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

import { pickDefaultPipelineTargetId } from '~/home/(user)/_lib/pipeline-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

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
  accountSlug?: string;
};

export function AddDealDialog({
  businesses,
  onDealCreated,
  accountSlug,
}: Props) {
  const workspaceScoped = Boolean(accountSlug?.trim());
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState('lead');
  const [businessId, setBusinessId] = useState(() =>
    pickDefaultPipelineTargetId(businesses, { workspaceScoped }),
  );

  useEffect(() => {
    if (!open) return;
    setBusinessId(pickDefaultPipelineTargetId(businesses, { workspaceScoped }));
  }, [open, businesses, workspaceScoped]);

  const showAssignField = !workspaceScoped && businesses.length > 1;

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
    const resolvedBusinessId =
      businessId || pickDefaultPipelineTargetId(businesses, { workspaceScoped });

    if (!resolvedBusinessId) {
      setError(
        workspaceScoped
          ? 'No workspace available for this pipeline.'
          : 'Join or create a workspace before adding leads.',
      );
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
        businessId: resolvedBusinessId,
        accountSlug: accountSlug ?? null,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create lead');
        return;
      }

      const biz = businesses.find((b) => b.id === resolvedBusinessId);
      onDealCreated({
        id: result.id!,
        contactName,
        companyName,
        value,
        stage,
        nextAction,
        nextActionDate: nextActionDate || null,
        businessId: resolvedBusinessId,
        businessName: biz?.name ?? '',
        businessColor: biz?.color ?? null,
      });

      setOpen(false);
      setStage('lead');
      setBusinessId(pickDefaultPipelineTargetId(businesses, { workspaceScoped }));
      formRef.current?.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={workspaceBtnPrimaryMd}
        >
          <Plus className="h-4 w-4" />
          Add lead
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/8 bg-[#0F1923] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new lead</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {workspaceScoped
              ? 'Track a lead or opportunity for this workspace. Company name is optional.'
              : 'Create a pipeline lead and assign it to a workspace.'}
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

          <div className={`grid gap-4 ${showAssignField ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showAssignField ? (
              <div className="space-y-2">
                <Label className="text-zinc-300">Workspace *</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                    {businesses.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id}>
                        <span className="flex items-center gap-2">
                          {biz.color ? (
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: biz.color }}
                            />
                          ) : null}
                          {biz.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
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
              Lead value (£)
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
                placeholder="Short description for this lead"
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
              className={workspaceBtnPrimaryMd}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create lead'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
