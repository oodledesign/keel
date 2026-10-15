'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import { Activity, Loader2, MessageSquare } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type SurveyorLeadEvent,
  mergeLeadActivity,
} from '~/lib/building-surveyor/lead-activity';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { listSurveyorLeadEventsAction } from '../../_lib/server/surveyor-lead-actions';
import {
  type WipAttachmentNote,
  createWipAttachmentNote,
  listWipAttachmentNotes,
} from '../../_lib/server/wip-attachments.actions';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Stage moves, ticks, archives and reminders, merged with manual updates. */
export function LeadActivityFeed({
  accountId,
  accountSlug,
  dealId,
  refreshKey = 0,
}: {
  accountId: string;
  accountSlug: string;
  dealId: string;
  /** Bump to reload after the lead is saved elsewhere. */
  refreshKey?: number;
}) {
  const [events, setEvents] = useState<SurveyorLeadEvent[]>([]);
  const [notes, setNotes] = useState<WipAttachmentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, startPosting] = useTransition();

  const load = useCallback(async () => {
    try {
      const [nextEvents, nextNotes] = await Promise.all([
        listSurveyorLeadEventsAction({ accountId, dealId }),
        listWipAttachmentNotes({ accountId, pipelineDealId: dealId }),
      ]);
      setEvents(nextEvents);
      setNotes(nextNotes);
    } catch (error) {
      console.error('[lead-activity] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [accountId, dealId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const items = useMemo(
    () => mergeLeadActivity(events, notes),
    [events, notes],
  );

  const postUpdate = () => {
    const content = body.trim();
    if (!content) return;
    startPosting(async () => {
      try {
        await createWipAttachmentNote({
          accountId,
          accountSlug,
          pipelineDealId: dealId,
          content,
          title: null,
        });
        setBody('');
        await load();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add an update, e.g. Called the client, waiting on the vendor"
          rows={3}
          aria-label="New update"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              postUpdate();
            }
          }}
        />
        <div className="flex justify-end">
          <button
            type="button"
            className={`${workspaceBtnPrimaryMd} h-8 px-3 text-xs`}
            disabled={posting || !body.trim()}
            onClick={postUpdate}
          >
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add update
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <p className={`py-6 text-center text-xs ${workspaceTextMuted}`}>
            Loading activity…
          </p>
        ) : items.length === 0 ? (
          <p className={`py-6 text-center text-xs ${workspaceTextMuted}`}>
            No activity yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
                  {item.kind === 'note' ? (
                    <MessageSquare className="h-3 w-3" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                    {item.text}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${workspaceTextMuted}`}>
                    {item.actor} · {timeFormat.format(new Date(item.at))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
