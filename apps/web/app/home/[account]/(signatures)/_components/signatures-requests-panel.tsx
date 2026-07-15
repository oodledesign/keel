'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AlertTriangle, Check, X } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  type SignatureChangeRequest,
  labelForChangeRequestField,
} from '~/lib/signatures/change-request-fields';

import { updateSignatureChangeRequestStatusAction } from '../_lib/server/signatures-module-actions';

export function SignaturesRequestsPanel({
  accountId,
  accountSlug,
  requests,
}: {
  accountId: string;
  accountSlug: string;
  requests: SignatureChangeRequest[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!requests.length) {
    return (
      <div className="text-muted-foreground rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-sm">
        No change requests yet. Staff can submit them from their personal
        install page when something looks wrong.
      </div>
    );
  }

  const updateStatus = (
    requestId: string,
    status: 'resolved' | 'dismissed',
  ) => {
    setPendingId(requestId);
    startTransition(async () => {
      try {
        await updateSignatureChangeRequestStatusAction({
          accountId,
          requestId,
          status,
        });
        toast.success(status === 'resolved' ? 'Marked resolved' : 'Dismissed');
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const staffPath = pathsConfig.app.accountSignaturesStaffDetail
          .replace('[account]', accountSlug)
          .replace('[staffId]', request.staff_id);
        const busy = pending && pendingId === request.id;

        return (
          <article
            key={request.id}
            id={`request-${request.id}`}
            data-staff-id={request.staff_id}
            className="scroll-mt-24 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5"
          >
            <div id={`staff-${request.staff_id}`} className="sr-only" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--workspace-shell-text)]">
                    {request.staff_name || request.requester_name || 'Staff'}
                  </h3>
                  <Badge
                    variant="outline"
                    className={
                      request.status === 'open'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : undefined
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {request.staff_email || request.requester_email || 'No email'}{' '}
                  ·{' '}
                  {new Date(request.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`${staffPath}?request=${request.id}`}>
                  Open staff
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {request.field_keys.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {labelForChangeRequestField(key)}
                </span>
              ))}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--workspace-shell-text)]">
              {request.message}
            </p>

            {request.status === 'open' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => updateStatus(request.id, 'resolved')}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Resolve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => updateStatus(request.id, 'dismissed')}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
