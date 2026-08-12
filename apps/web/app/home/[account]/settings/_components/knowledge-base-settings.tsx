'use client';

import { useState } from 'react';

import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getBrainKnowledgeStats } from '../../brain/_lib/server/brain-actions';

type KnowledgeStats = {
  totalChunks: number;
  byType: Record<string, { count: number; lastIndexedAt: string | null }>;
};

type ReindexSourceRef = {
  sourceType: string;
  sourceId: string;
  title: string;
};

type ReindexBatchResult = {
  indexed?: number;
  processed?: number;
  total?: number;
  nextOffset?: number;
  done?: boolean;
  chunks?: number;
  totalChunks?: number;
  byType?: KnowledgeStats['byType'];
  errors?: string[];
  error?: string;
  sources?: ReindexSourceRef[];
};

async function readReindexResponse(res: Response): Promise<ReindexBatchResult> {
  const text = await res.text();

  try {
    return JSON.parse(text) as ReindexBatchResult;
  } catch {
    throw new Error(
      res.ok
        ? 'Re-index returned an invalid response'
        : `Re-index failed (${res.status})`,
    );
  }
}

export function KnowledgeBaseSettings({
  accountId,
  accountSlug,
  initialStats,
}: {
  accountId: string;
  accountSlug: string;
  initialStats: KnowledgeStats;
}) {
  const [stats, setStats] = useState<KnowledgeStats>(initialStats);
  const [isReindexing, setIsReindexing] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [lastErrors, setLastErrors] = useState<string[]>([]);

  const handleReindex = async () => {
    setIsReindexing(true);
    setLastErrors([]);
    setProgress({ processed: 0, total: 0 });

    try {
      let offset = 0;
      let indexed = 0;
      const errors: string[] = [];
      let last: ReindexBatchResult | null = null;
      let catalog: ReindexSourceRef[] | null = null;

      do {
        const res = await fetch('/api/brain/reindex', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            accountId,
            offset,
            ...(catalog
              ? {
                  sources: catalog.slice(offset, offset + 4),
                  total: catalog.length,
                }
              : {}),
          }),
        });

        const result = await readReindexResponse(res);

        if (!res.ok) {
          throw new Error(result.error ?? 'Re-index failed');
        }

        last = result;
        indexed += result.indexed ?? 0;
        errors.push(...(result.errors ?? []));

        if (result.sources?.length) {
          catalog = result.sources;
        }

        const nextOffset = result.nextOffset ?? offset;
        if (!result.done && nextOffset <= offset) {
          throw new Error('Re-index did not advance');
        }

        offset = nextOffset;
        setProgress({
          processed: result.processed ?? offset,
          total: result.total ?? 0,
        });

        if (result.totalChunks != null || result.byType) {
          setStats({
            totalChunks: result.totalChunks ?? result.chunks ?? 0,
            byType: result.byType ?? {},
          });
        }
      } while (last && !last.done);

      const errorCount = errors.length;
      const totalChunks = last?.totalChunks ?? last?.chunks ?? 0;

      if (errorCount > 0) {
        setLastErrors(errors);
        toast.warning(
          `Indexed ${indexed} sources — ${totalChunks} chunk${totalChunks === 1 ? '' : 's'} in knowledge base. ${errorCount} source${errorCount === 1 ? '' : 's'} failed.`,
        );
      } else {
        toast.success(
          `Indexed ${indexed} sources — ${totalChunks} chunk${totalChunks === 1 ? '' : 's'} in knowledge base.`,
        );
      }

      const next = await getBrainKnowledgeStats({ accountId, accountSlug });
      setStats(next as KnowledgeStats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-index failed');
    } finally {
      setIsReindexing(false);
      setProgress(null);
    }
  };

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Knowledge base
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Semantic index for Second Brain chat and search.
          </p>
          {progress ? (
            <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Re-indexing {progress.processed} of {progress.total || '…'}{' '}
              sources…
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-[color:var(--workspace-shell-border)]"
          disabled={isReindexing}
          onClick={() => void handleReindex()}
        >
          {isReindexing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Re-index all
        </Button>
      </div>

      {lastErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <p className="font-medium">Sources that failed to index</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-50/90">
            {lastErrors.map((error, index) => (
              <li key={`${index}:${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-3">
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
            Total chunks
          </dt>
          <dd className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {stats.totalChunks}
          </dd>
        </div>
      </dl>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-[var(--workspace-shell-text-muted)] uppercase">
            <tr>
              <th className="pr-4 pb-2">Source type</th>
              <th className="pr-4 pb-2">Chunks</th>
              <th className="pb-2">Last indexed</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byType).map(([type, row]) => (
              <tr
                key={type}
                className="border-t border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
              >
                <td className="py-2 pr-4 capitalize">
                  {type.replaceAll('_', ' ')}
                </td>
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
                <td
                  colSpan={3}
                  className="py-4 text-[var(--workspace-shell-text-muted)]"
                >
                  No chunks indexed yet. Run a full re-index to populate the
                  knowledge base.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
