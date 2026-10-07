'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { workspaceBorder, workspaceTextMuted } from '~/lib/workspace-ui';

import type { FeedflowReviewRow } from '../../_lib/server/feedflow-account-data';
import {
  addManualReview,
  deleteReview,
  importReviewsCsv,
  setReviewHidden,
} from '../_lib/server/feedflow-webflow-actions';

const MAX_CSV_BYTES = 1_000_000;

const CSV_HINT =
  'reviewer,rating,comment,date\n"Jo Smith",5,"Brilliant service",2026-01-14';

export function FeedflowReviewsManager(props: {
  accountId: string;
  clientId: string | null;
  reviews: FeedflowReviewRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className={`space-y-3 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await addManualReview({
                accountId: props.accountId,
                clientId: props.clientId,
                reviewerName: name,
                rating: Number(rating),
                comment,
              });
              setName('');
              setComment('');
              toast.success('Review added');
            });
          }}
        >
          <p className="text-sm font-medium">Add a review</p>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-1">
              <Label htmlFor="review-name">Reviewer</Label>
              <Input
                id="review-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="review-rating">Stars</Label>
              <Input
                id="review-rating"
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-comment">Review text</Label>
            <Textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            Add review
          </Button>
        </form>

        <form
          className={`space-y-3 rounded-lg border bg-[var(--workspace-shell-panel)] p-4 ${workspaceBorder}`}
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              const result = await importReviewsCsv({
                accountId: props.accountId,
                clientId: props.clientId,
                csv,
              });
              setCsv('');
              setFileName(null);
              toast.success(
                `Imported ${result.imported} reviews` +
                  (result.errors.length
                    ? ` (${result.errors.length} rows skipped)`
                    : ''),
              );
            });
          }}
        >
          <p className="text-sm font-medium">Import CSV</p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Upload or paste a CSV with reviewer and rating columns (comment and date
            optional). Re-importing the same rows will not create duplicates.
          </p>
          <Input
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              if (file.size > MAX_CSV_BYTES) {
                toast.error('CSV is too large (1 MB max)');
                return;
              }
              void file.text().then((text) => {
                setCsv(text);
                setFileName(file.name);
              });
            }}
          />
          <p className={`text-xs ${workspaceTextMuted}`}>
            {fileName ? `Loaded ${fileName}. ` : ''}Or paste rows below.
          </p>
          <Textarea
            rows={4}
            value={csv}
            placeholder={CSV_HINT}
            onChange={(event) => {
              setCsv(event.target.value);
              setFileName(null);
            }}
            className="font-mono text-xs"
          />
          <Button type="submit" disabled={pending || !csv.trim()}>
            Import reviews
          </Button>
        </form>
      </div>

      {props.reviews.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>No reviews yet.</p>
      ) : (
        <div
          className={`overflow-x-auto rounded-lg border ${workspaceBorder}`}
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead
              className={`border-b text-xs tracking-wide uppercase ${workspaceBorder} ${workspaceTextMuted}`}
            >
              <tr>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {props.reviews.map((review) => (
                <tr
                  key={review.id}
                  className={`border-b last:border-0 ${workspaceBorder} ${review.hidden ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">{review.reviewer_name}</td>
                  <td className="px-4 py-3">{'★'.repeat(review.rating)}</td>
                  <td className="max-w-md truncate px-4 py-3">
                    {review.comment ?? '—'}
                  </td>
                  <td className={`px-4 py-3 ${workspaceTextMuted}`}>
                    {review.source}
                  </td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          await setReviewHidden({
                            accountId: props.accountId,
                            reviewId: review.id,
                            hidden: !review.hidden,
                          });
                        })
                      }
                    >
                      {review.hidden ? 'Show' : 'Hide'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm('Delete this review?')) return;
                        run(async () => {
                          await deleteReview({
                            accountId: props.accountId,
                            reviewId: review.id,
                          });
                        });
                      }}
                    >
                      Delete
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
