'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FileSignature, Link2, Loader2, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';

import {
  linkSurveyToLeadAction,
  listUnlinkedSurveysAction,
  sendSurveyorTermsAction,
} from '../../_lib/server/surveyor-lead-actions';

type UnlinkedSurvey = {
  id: string;
  title: string;
  address: string | null;
  status: string | null;
  createdAt: string;
};

export function SurveyorBookedDialog({
  open,
  onOpenChange,
  deal,
  accountId,
  accountSlug,
  onCreateSurvey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: PipelineDeal | null;
  accountId: string;
  accountSlug: string;
  onCreateSurvey: (dealId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'menu' | 'link' | 'terms'>('menu');
  const [surveys, setSurveys] = useState<UnlinkedSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('menu');
      setSurveys([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'link') return;
    let cancelled = false;
    setLoadingSurveys(true);
    void listUnlinkedSurveysAction({ accountId })
      .then((rows) => {
        if (!cancelled) setSurveys(rows);
      })
      .catch((error) => {
        if (!cancelled) toast.error(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingSurveys(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, mode, open]);

  if (!deal) return null;

  const clientEmail = deal.surveyorLead?.contactEmail?.trim() || null;
  const settingsHref = pathsConfig.app.accountSurveyorProfileSettings.replace(
    '[account]',
    accountSlug,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lead booked</DialogTitle>
          <DialogDescription>
            {deal.contactName || deal.name || 'This lead'} is booked. Create or
            link a survey, or send terms of business.
          </DialogDescription>
        </DialogHeader>

        {mode === 'menu' ? (
          <div className="grid gap-2">
            <Button
              type="button"
              className="justify-start"
              onClick={() => {
                onOpenChange(false);
                onCreateSurvey(deal.id);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create survey now
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => setMode('link')}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Link an existing survey
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => setMode('terms')}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              Send terms of business
            </Button>
          </div>
        ) : null}

        {mode === 'link' ? (
          <div className="space-y-3">
            {loadingSurveys ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading surveys…
              </p>
            ) : surveys.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No unlinked surveys in this workspace.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {surveys.map((survey) => (
                  <li key={survey.id}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start py-2 text-left"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await linkSurveyToLeadAction({
                              accountId,
                              accountSlug,
                              dealId: deal.id,
                              proposalId: survey.id,
                            });
                            toast.success('Survey linked');
                            onOpenChange(false);
                            router.refresh();
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        });
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="block font-medium">{survey.title}</span>
                        {survey.address ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {survey.address}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('menu')}
            >
              Back
            </Button>
          </div>
        ) : null}

        {mode === 'terms' ? (
          <div className="space-y-3 text-sm">
            <p>
              We will create the terms of business letter for this lead, apply
              your saved firm signature, and email it to{' '}
              <strong>{clientEmail || 'the client'}</strong>.
            </p>
            {!clientEmail ? (
              <p className="text-amber-600 dark:text-amber-400">
                Add a client email on the lead first.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              No signature saved yet?{' '}
              <Link href={settingsHref} className="underline">
                Open Surveyor profile settings
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || !clientEmail}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await sendSurveyorTermsAction({
                        accountId,
                        accountSlug,
                        dealId: deal.id,
                      });
                      toast.success('Terms of business sent');
                      onOpenChange(false);
                      router.refresh();
                    } catch (error) {
                      toast.error(getErrorMessage(error));
                    }
                  });
                }}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Preview and send
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('menu')}
              >
                Back
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
