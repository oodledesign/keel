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

import { upsertModelRateAction } from '../_lib/server/finances.actions';

export function FinancesModelRatesForm() {
  const router = useRouter();
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'google' | 'other'>(
    'anthropic',
  );
  const [inputRate, setInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertModelRateAction({
        model,
        provider,
        inputUsdPerMtok: Number(inputRate),
        outputUsdPerMtok: Number(outputRate),
      });
      toast.success('Model rate saved');
      setModel('');
      setInputRate('');
      setOutputRate('');
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
        <Label htmlFor="rate-model">Model id</Label>
        <Input
          id="rate-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-sonnet-4-6"
          className="font-mono text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select
          value={provider}
          onValueChange={(value) =>
            setProvider(value as 'anthropic' | 'google' | 'other')
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rate-in">Input USD / MTok</Label>
        <Input
          id="rate-in"
          type="number"
          min={0}
          step="0.000001"
          value={inputRate}
          onChange={(e) => setInputRate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rate-out">Output USD / MTok</Label>
        <Input
          id="rate-out"
          type="number"
          min={0}
          step="0.000001"
          value={outputRate}
          onChange={(e) => setOutputRate(e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <Button
          type="button"
          onClick={save}
          disabled={saving || !model.trim() || !inputRate || !outputRate}
        >
          {saving ? 'Saving…' : 'Save model rate'}
        </Button>
      </div>
    </div>
  );
}
