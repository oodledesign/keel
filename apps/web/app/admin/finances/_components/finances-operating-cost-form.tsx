'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
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

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { OPERATING_COST_CATEGORIES } from '../_lib/schema';
import { upsertOperatingCostAction } from '../_lib/server/finances.actions';

export function FinancesOperatingCostForm({
  periodMonth,
}: {
  /** YYYY-MM-01 */
  periodMonth: string;
}) {
  const router = useRouter();
  const [category, setCategory] =
    useState<(typeof OPERATING_COST_CATEGORIES)[number]>('vercel');
  const [label, setLabel] = useState('');
  const [amountMajor, setAmountMajor] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertOperatingCostAction({
        category,
        label,
        amountMajor: Number(amountMajor),
        currency: 'gbp',
        periodMonth,
        notes: notes || null,
      });
      toast.success('Operating cost saved');
      setLabel('');
      setAmountMajor('');
      setNotes('');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={category}
          onValueChange={(value) =>
            setCategory(value as (typeof OPERATING_COST_CATEGORIES)[number])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATING_COST_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost-label">Label</Label>
        <Input
          id="cost-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Vercel Pro"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost-amount">Amount (£)</Label>
        <Input
          id="cost-amount"
          type="number"
          min={0}
          step="0.01"
          value={amountMajor}
          onChange={(e) => setAmountMajor(e.target.value)}
          placeholder="20.00"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost-notes">Notes</Label>
        <Input
          id="cost-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="md:col-span-2">
        <Button
          type="button"
          onClick={save}
          disabled={saving || !label.trim() || !amountMajor}
        >
          {saving ? 'Saving…' : 'Add cost'}
        </Button>
      </div>
    </div>
  );
}
