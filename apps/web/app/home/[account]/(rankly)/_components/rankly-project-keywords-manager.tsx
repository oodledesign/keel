'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { RanklyKeywordRow } from '../../_lib/server/rankly-account-data';
import { parseKeywordLines } from '../_lib/parse-keyword-lines';
import {
  addRanklyKeywordsBulk,
  deleteRanklyKeyword,
} from '../_lib/server/rankly-module-actions';

export function RanklyProjectKeywordsManager(props: {
  accountId: string;
  projectId: string;
  keywords: RanklyKeywordRow[];
}) {
  const router = useRouter();
  const [keywordsText, setKeywordsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parsedCount = useMemo(
    () => parseKeywordLines(keywordsText).length,
    [keywordsText],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = parseKeywordLines(keywordsText);

    if (keywords.length === 0) {
      toast.error('Enter at least one keyword, one per line');
      return;
    }

    if (keywords.length > 500) {
      toast.error('Add up to 500 keywords at a time');
      return;
    }

    setBusy(true);
    try {
      const result = await addRanklyKeywordsBulk({
        accountId: props.accountId,
        projectId: props.projectId,
        keywords,
        search_engine: 'google',
        device: 'desktop',
      });

      if (result.added === 0) {
        toast.message(
          'No new keywords added — all were already on this project',
        );
      } else if (result.skipped > 0) {
        toast.success(
          `Added ${result.added} keyword${result.added === 1 ? '' : 's'} (${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped)`,
        );
      } else {
        toast.success(
          `Added ${result.added} keyword${result.added === 1 ? '' : 's'}`,
        );
      }

      setKeywordsText('');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (keywordId: string) => {
    setDeletingId(keywordId);
    try {
      await deleteRanklyKeyword({
        accountId: props.accountId,
        keywordId,
      });
      toast.success('Keyword removed');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="max-w-xl space-y-3">
        <div className="space-y-2">
          <Label htmlFor="new-keywords">Add keywords</Label>
          <Textarea
            id="new-keywords"
            rows={8}
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder={
              'best crm software\nproject management tools\ncustomer support platform'
            }
            className="font-mono text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            One keyword per line. Paste from a spreadsheet or export — up to 500
            at a time.
            {parsedCount > 0 ? ` ${parsedCount} ready to add.` : null}
          </p>
        </div>
        <Button type="submit" disabled={busy || parsedCount === 0}>
          {busy
            ? 'Adding…'
            : parsedCount > 1
              ? `Add ${parsedCount} keywords`
              : 'Add keywords'}
        </Button>
      </form>

      {props.keywords.length === 0 ? (
        <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
          No keywords yet. Add phrases to track in search results.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Engine</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {props.keywords.map((k) => (
                <tr
                  key={k.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                >
                  <td className="px-4 py-3">{k.keyword}</td>
                  <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                    {k.search_engine}
                  </td>
                  <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                    {k.device}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deletingId === k.id}
                      onClick={() => remove(k.id)}
                    >
                      {deletingId === k.id ? '…' : 'Remove'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
