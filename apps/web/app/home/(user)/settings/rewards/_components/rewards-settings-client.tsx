'use client';

import { useMemo, useState, useTransition } from 'react';

import { Copy, Gift, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import {
  submitContentRewardAction,
  updateRewardCreditTargetAction,
} from '../_lib/server/rewards.actions';

type WorkspaceOption = {
  id: string;
  name: string;
  slug: string | null;
};

type ReferralRow = {
  id: string;
  status: string;
  utmSource: string | null;
  createdAt: string;
  convertedAt: string | null;
  referredEmail: string | null;
};

type ContentSubmission = {
  id: string;
  content_type: string;
  post_url: string | null;
  status: string;
  reward_amount_pence: number | null;
  rejection_reason: string | null;
  created_at: string;
};

type RewardsSettingsClientProps = {
  referralLink: string;
  referralCode: string;
  rewardCreditTarget: 'personal' | 'workspace';
  rewardCreditWorkspaceId: string | null;
  workspaces: WorkspaceOption[];
  referrals: ReferralRow[];
  totalReferralCreditPence: number;
  contentSubmissions: ContentSubmission[];
  contentCaps: {
    monthlyUsedPence: number;
    monthlyCapPence: number;
    annualUsedPence: number;
    annualCapPence: number;
  };
  contentTiersPence: Record<string, number>;
};

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function formatGbp(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function statusBadge(status: string) {
  if (status === 'converted' || status === 'approved') {
    return <Badge variant="success">{status}</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function RewardsSettingsClient(props: RewardsSettingsClientProps) {
  const [target, setTarget] = useState(props.rewardCreditTarget);
  const [workspaceId, setWorkspaceId] = useState(
    props.rewardCreditWorkspaceId ?? '',
  );
  const [contentType, setContentType] = useState('story');
  const [postUrl, setPostUrl] = useState('');
  const [pending, startTransition] = useTransition();

  const tierAmount = props.contentTiersPence[contentType] ?? 0;

  const capBlocked = useMemo(() => {
    return (
      props.contentCaps.monthlyUsedPence + tierAmount >
        props.contentCaps.monthlyCapPence ||
      props.contentCaps.annualUsedPence + tierAmount >
        props.contentCaps.annualCapPence
    );
  }, [props.contentCaps, tierAmount]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(props.referralLink);
      toast.success('Referral link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Ozer',
          url: props.referralLink,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyLink();
  };

  const saveCreditTarget = () => {
    startTransition(async () => {
      try {
        await updateRewardCreditTargetAction({
          target,
          workspaceId: target === 'workspace' ? workspaceId || null : null,
        });
        toast.success('Credit destination updated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save settings',
        );
      }
    });
  };

  const submitContent = () => {
    startTransition(async () => {
      try {
        await submitContentRewardAction({
          contentType: contentType as 'story' | 'image_post' | 'reel',
          postUrl: postUrl || undefined,
        });
        toast.success('Submission received — we will review it soon');
        setPostUrl('');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not submit',
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Refer friends
          </CardTitle>
          <CardDescription>
            Share your link. When a friend subscribes, you both earn credit (50%
            of their plan&apos;s monthly price).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referral-link">Your referral link</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="referral-link" readOnly value={props.referralLink} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={copyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button type="button" onClick={shareLink}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Code: {props.referralCode}
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Total referral credit earned</p>
            <p className="text-2xl font-semibold">
              {formatGbp(props.totalReferralCreditPence)}
            </p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Apply credit to</Label>
            <Select
              value={target}
              onValueChange={(v) => setTarget(v as 'personal' | 'workspace')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal account</SelectItem>
                <SelectItem value="workspace">A workspace</SelectItem>
              </SelectContent>
            </Select>

            {target === 'workspace' ? (
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose workspace" />
                </SelectTrigger>
                <SelectContent>
                  {props.workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                      {ws.slug ? ` (${ws.slug})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Button
              type="button"
              disabled={pending || (target === 'workspace' && !workspaceId)}
              onClick={saveCreditTarget}
            >
              Save credit destination
            </Button>
          </div>

          {props.referrals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referred</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.referrals.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.referredEmail
                        ? maskEmail(row.referredEmail)
                        : 'Pending signup'}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell>{row.utmSource ?? '—'}</TableCell>
                    <TableCell>
                      {new Date(row.createdAt).toLocaleDateString('en-GB')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No referrals yet — share your link to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content rewards</CardTitle>
          <CardDescription>
            Post about Ozer on social media. Rewards: story{' '}
            {formatGbp(props.contentTiersPence.story ?? 250)}, image{' '}
            {formatGbp(props.contentTiersPence.image_post ?? 500)}, reel{' '}
            {formatGbp(props.contentTiersPence.reel ?? 1000)}. Cap{' '}
            {formatGbp(props.contentCaps.monthlyCapPence)}/month,{' '}
            {formatGbp(props.contentCaps.annualCapPence)}/year (pending +
            approved).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Used this month: {formatGbp(props.contentCaps.monthlyUsedPence)} ·
            This year: {formatGbp(props.contentCaps.annualUsedPence)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Content type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="story">Story (£2.50)</SelectItem>
                  <SelectItem value="image_post">Image post (£5)</SelectItem>
                  <SelectItem value="reel">Reel 15s+ (£10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-url">Post URL</Label>
              <Input
                id="post-url"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={pending || capBlocked || !postUrl.trim()}
            onClick={submitContent}
          >
            Submit for review
          </Button>

          {capBlocked ? (
            <p className="text-destructive text-sm">
              This submission would exceed your content reward cap.
            </p>
          ) : null}

          {props.contentSubmissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.contentSubmissions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.content_type.replace('_', ' ')}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell>
                      {row.reward_amount_pence
                        ? formatGbp(row.reward_amount_pence)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {new Date(row.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
