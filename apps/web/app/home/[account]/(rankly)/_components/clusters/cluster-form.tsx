'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export function ClusterForm(props: {
  accountId: string;
  projectId: string;
  clustersPath: string;
}) {
  const router = useRouter();
  const [seeds, setSeeds] = useState('');
  const [country, setCountry] = useState('gb');
  const [minVolume, setMinVolume] = useState(100);
  const [maxKD, setMaxKD] = useState(60);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seedList = seeds
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (seedList.length < 3 || seedList.length > 20) {
      toast.error('Enter 3–20 seed keywords, one per line.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/rankly/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          seeds: seedList,
          country,
          minVolume,
          maxKD,
        }),
      });

      const json = (await res.json()) as ApiResponse<{ jobId: string }>;
      if (!json.ok) {
        throw new Error(json.error.message);
      }

      toast.success('Cluster job started');
      router.push(`${props.clustersPath}/${json.data.jobId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cluster-seeds">
          Seed keywords (one per line, 3–20)
        </Label>
        <textarea
          id="cluster-seeds"
          rows={6}
          value={seeds}
          onChange={(e) => setSeeds(e.target.value)}
          placeholder={
            'accountant near me\nsmall business accountant\nbookkeeping services'
          }
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[8rem] w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cluster-country">Country</Label>
          <select
            id="cluster-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="gb">United Kingdom</option>
            <option value="us">United States</option>
            <option value="au">Australia</option>
            <option value="ca">Canada</option>
            <option value="ie">Ireland</option>
            <option value="nz">New Zealand</option>
            <option value="za">South Africa</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cluster-min-volume">Min volume</Label>
          <input
            id="cluster-min-volume"
            type="number"
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cluster-max-kd">Max KD</Label>
          <input
            id="cluster-max-kd"
            type="number"
            value={maxKD}
            onChange={(e) => setMaxKD(Number(e.target.value))}
            className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Starting…' : 'Build cluster plan'}
      </Button>
    </form>
  );
}
