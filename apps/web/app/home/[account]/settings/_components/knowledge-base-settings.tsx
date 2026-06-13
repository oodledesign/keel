'use client';

import { useState, useTransition } from 'react';

import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  getBrainKnowledgeStats,
  reindexBrainAccount,
} from '../../brain/_lib/server/brain-actions';

export function KnowledgeBaseSettings({
  accountId,
  accountSlug,
  initialStats,
  voyageConfigured,
}: {
  accountId: string;
  accountSlug: string;
  initialStats: {
    totalChunks: number;
    byType: Record<string, { count: number; lastIndexedAt: string | null }>;
    voyageConfigured: boolean;
  };
  voyageConfigured: boolean;
}) {
  const [stats, setStats] = useState(initialStats);
  const [pending, startTransition] = useTransition();

  const refreshStats = () => {
    startTransition(async () => {
      try {
        const next = await getBrainKnowledgeStats({ accountId, accountSlug });
        setStats(next as typeof initialStats);
      } catch {
        toast.error('Could not refresh stats');
      }
    });
  };

  const handleReindex = () => {
    startTransition(async () => {
      try {
        const result = await reindexBrainAccount({ accountId, accountSlug });
        toast.success(
          `Indexed ${(result as { indexed?: number }).indexed ?? 0} sources`,
        );
        refreshStats();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Re-index failed');
      }
    });
  };

  return (
    <section className="rounded-xl border border-zinc-700 bg-[var(--workspace-shell-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Knowledge base</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Semantic index for Second brain chat. Requires{' '}
            <code className="text-zinc-300">VOYAGE_API_KEY</code>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-zinc-600"
          disabled={pending || !voyageConfigured}
          onClick={handleReindex}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Re-index all
        </Button>
      </div>

      {!voyageConfigured && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Add VOYAGE_API_KEY to your environment to enable indexing and chat
          search.
        </p>
      )}

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
          <dt className="text-xs text-zinc-500">Total chunks</dt>
          <dd className="text-2xl font-semibold text-white">
            {stats.totalChunks}
          </dd>
        </div>
      </dl>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="pb-2 pr-4">Source type</th>
              <th className="pb-2 pr-4">Chunks</th>
              <th className="pb-2">Last indexed</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byType).map(([type, row]) => (
              <tr key={type} className="border-t border-zinc-800 text-zinc-300">
                <td className="py-2 pr-4 capitalize">{type.replace('_', ' ')}</td>
                <td className="py-2 pr-4">{row.count}</td>
                <td className="py-2">
                  {row.lastIndexedAt
                    ? new Date(row.lastIndexedAt).toLocaleString('en-GB')
                    : '—'}
                </td>
              </tr>
            ))}
            {Object.keys(stats.byType).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-zinc-500">
                  No chunks indexed yet. Run a full re-index after adding
                  VOYAGE_API_KEY.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
