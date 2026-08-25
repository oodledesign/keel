'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Textarea } from '@kit/ui/textarea';

import { reviewContentSubmissionAction } from '../_lib/server/admin-content-rewards.actions';

export type AdminContentSubmissionRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  content_type: string;
  post_url: string | null;
  screenshot_path: string | null;
  reward_amount_pence: number | null;
  created_at: string;
};

export function AdminContentRewardsTable({
  submissions,
}: {
  submissions: AdminContentSubmissionRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followOzer, setFollowOzer] = useState(false);
  const [followerCount, setFollowerCount] = useState('');
  const [accountAgeDays, setAccountAgeDays] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [pending, startTransition] = useTransition();

  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  const review = (decision: 'approve' | 'reject') => {
    if (!selected) return;

    startTransition(async () => {
      try {
        await reviewContentSubmissionAction({
          submissionId: selected.id,
          decision,
          followOzerConfirmed: followOzer,
          followerCount: followerCount ? Number(followerCount) : undefined,
          accountAgeDays: accountAgeDays ? Number(accountAgeDays) : undefined,
          reviewNotes: reviewNotes || undefined,
          rejectionReason: rejectionReason || undefined,
        });
        toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
        setSelectedId(null);
        setFollowOzer(false);
        setFollowerCount('');
        setAccountAgeDays('');
        setReviewNotes('');
        setRejectionReason('');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Review failed');
      }
    });
  };

  if (submissions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No pending submissions.</p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reward</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((row) => (
            <TableRow
              key={row.id}
              className={
                selectedId === row.id ? 'bg-muted/50' : 'cursor-pointer'
              }
              onClick={() => setSelectedId(row.id)}
            >
              <TableCell>{row.user_email ?? row.user_id.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge variant="outline">{row.content_type}</Badge>
              </TableCell>
              <TableCell>
                {row.reward_amount_pence
                  ? `£${(row.reward_amount_pence / 100).toFixed(2)}`
                  : '—'}
              </TableCell>
              <TableCell>
                {new Date(row.created_at).toLocaleDateString('en-GB')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected ? (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium">Review submission</h3>
          {selected.post_url ? (
            <p className="text-sm break-all">
              <a
                href={selected.post_url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--ozer-info)] underline"
              >
                {selected.post_url}
              </a>
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Checkbox
              id="follow-ozer"
              checked={followOzer}
              onCheckedChange={(v) => setFollowOzer(Boolean(v))}
            />
            <Label htmlFor="follow-ozer">Follows @ozer.so</Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="followers">Follower count</Label>
              <Input
                id="followers"
                type="number"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-age">Account age (days)</Label>
              <Input
                id="account-age"
                type="number"
                value={accountAgeDays}
                onChange={(e) => setAccountAgeDays(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Review notes</Label>
            <Textarea
              id="notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reject-reason">Rejection reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => review('approve')}
            >
              Approve & grant credit
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => review('reject')}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Select a submission to review.
        </p>
      )}
    </div>
  );
}
