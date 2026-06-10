'use client';

import { useState, useTransition } from 'react';

import { Check, Download, Loader2, MessageSquare, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  addProposalCommentByTokenAction,
  approveProposalByTokenAction,
  declineProposalByTokenAction,
} from '~/home/[account]/proposals/_lib/server/server-actions';
import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

type CommentRow = {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

type ProposalPayload = {
  id: string;
  title: string | null;
  content_html: string | null;
  status: string;
  total_pence: number | null;
  currency: string | null;
  expires_at: string | null;
  recipient_name: string | null;
  approved_at: string | null;
  declined_at: string | null;
  comments: CommentRow[];
  client: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  deal: {
    contact_name?: string | null;
    company_name?: string | null;
    name?: string | null;
  } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function PortalProposalView({
  proposal,
  token,
}: {
  proposal: Record<string, unknown>;
  token: string;
}) {
  const data = proposal as unknown as ProposalPayload;
  const [pending, startTransition] = useTransition();
  const [authorName, setAuthorName] = useState(data.recipient_name ?? '');
  const [commentBody, setCommentBody] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [localStatus, setLocalStatus] = useState(data.status);
  const [comments, setComments] = useState(data.comments ?? []);

  const recipientLabel =
    data.recipient_name?.trim() ||
    data.client?.display_name?.trim() ||
    data.deal?.contact_name?.trim() ||
    data.deal?.company_name?.trim() ||
    'Client';

  const canRespond = ['sent', 'read'].includes(localStatus);
  const pdfUrl = `/api/proposals/pdf?token=${encodeURIComponent(token)}`;

  const statusClasses =
    localStatus === 'approved'
      ? 'border-[var(--keel-teal)]/25 bg-[var(--keel-teal)]/12 text-[#97D9AA]'
      : localStatus === 'declined'
        ? 'border-[#E85D75]/25 bg-[#E85D75]/12 text-[#F6A7B5]'
        : localStatus === 'read'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : localStatus === 'sent'
            ? 'border-[#39AEB3]/25 bg-[#39AEB3]/12 text-[#B8D3D7]'
            : 'border-white/10 bg-white/6 text-[#D7DEEE]';

  const handleComment = () => {
    if (!commentBody.trim() || !authorName.trim()) {
      toast.error('Name and comment are required');
      return;
    }
    startTransition(async () => {
      try {
        const comment = await addProposalCommentByTokenAction({
          token,
          author_name: authorName.trim(),
          body: commentBody.trim(),
        });
        setComments((prev) => [...prev, comment as CommentRow]);
        setCommentBody('');
        toast.success('Comment posted');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approveProposalByTokenAction({
          token,
          recipient_name: authorName.trim() || null,
        });
        setLocalStatus('approved');
        toast.success('Proposal approved — thank you!');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const handleDecline = () => {
    startTransition(async () => {
      try {
        await declineProposalByTokenAction({
          token,
          reason: declineReason.trim() || null,
        });
        setLocalStatus('declined');
        setShowDecline(false);
        toast.success('Proposal declined');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {data.title?.trim() || 'Proposal'}
            </h1>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClasses}`}
            >
              {localStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">Prepared for {recipientLabel}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-6 text-sm">
        {data.expires_at ? (
          <div>
            <span className="text-zinc-500">Expires</span>
            <p className="font-medium text-zinc-200">{formatDate(data.expires_at)}</p>
          </div>
        ) : null}
        {data.total_pence != null ? (
          <div>
            <span className="text-zinc-500">Total</span>
            <p className="font-medium text-zinc-200">
              {formatPence(data.total_pence, data.currency ?? 'GBP')}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="prose prose-invert mt-8 max-w-none rounded-lg border border-zinc-700 bg-white p-6 text-[#1E293B] prose-headings:text-[#1E293B] prose-p:text-[#334155]"
        dangerouslySetInnerHTML={{
          __html: sanitizeCommunityHtml(data.content_html ?? ''),
        }}
      />

      {comments.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <MessageSquare className="h-4 w-4" />
            Comments
          </h2>
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <p className="text-xs text-zinc-500">
                {comment.author_name ?? 'Guest'} · {formatDate(comment.created_at)}
              </p>
              <p className="mt-1 text-sm text-zinc-200">{comment.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {canRespond ? (
        <div className="mt-8 space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h2 className="text-sm font-semibold text-white">Your response</h2>
          <div>
            <Label className="text-zinc-400">Your name</Label>
            <Input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name"
              className="mt-1 border-zinc-600 bg-zinc-900"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Leave a comment (optional)</Label>
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              placeholder="Questions or feedback…"
              className="mt-1 border-zinc-600 bg-zinc-900"
            />
          </div>
          {commentBody.trim() ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={handleComment}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post comment
            </Button>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-zinc-700 pt-4">
            <Button
              size="sm"
              disabled={pending}
              className="bg-[var(--keel-teal)] text-[#09111F] hover:bg-[#6BD48F]"
              onClick={handleApprove}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Approve proposal
            </Button>
            {!showDecline ? (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setShowDecline(true)}>
                <X className="mr-2 h-4 w-4" />
                Decline
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-zinc-400">Reason (optional)</Label>
                  <Input
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Let us know why"
                    className="mt-1 border-zinc-600 bg-zinc-900"
                  />
                </div>
                <Button variant="destructive" size="sm" disabled={pending} onClick={handleDecline}>
                  Confirm decline
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {localStatus === 'approved' ? (
        <div className="mt-6 rounded-lg border border-emerald-700 bg-[var(--keel-teal)]/10 px-4 py-3 text-[#5eead4]">
          This proposal was approved{data.approved_at ? ` on ${formatDate(data.approved_at)}` : ''}. Thank you!
        </div>
      ) : null}

      {localStatus === 'declined' ? (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          This proposal was declined{data.declined_at ? ` on ${formatDate(data.declined_at)}` : ''}.
        </div>
      ) : null}
    </div>
  );
}
