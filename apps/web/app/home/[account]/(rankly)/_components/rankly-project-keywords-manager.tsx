'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { RanklyKeywordRow } from '../../_lib/server/rankly-account-data';
import {
  addRanklyKeyword,
  deleteRanklyKeyword,
} from '../_lib/server/rankly-module-actions';

export function RanklyProjectKeywordsManager(props: {
  accountId: string;
  projectId: string;
  keywords: RanklyKeywordRow[];
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast.error('Keyword is required');
      return;
    }
    setBusy(true);
    try {
      await addRanklyKeyword({
        accountId: props.accountId,
        projectId: props.projectId,
        keyword: keyword.trim(),
        search_engine: 'google',
        device: 'desktop',
      });
      toast.success('Keyword added');
      setKeyword('');
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
      <form
        onSubmit={submit}
        className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="new-keyword">Add keyword</Label>
          <Input
            id="new-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. best crm software"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </form>

      {props.keywords.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No keywords yet. Add phrases to track in search results.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
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
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3">{k.keyword}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {k.search_engine}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{k.device}</td>
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
