'use client';

import { useEffect, useState, useTransition } from 'react';

import { Bell, BellOff, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  fetchPushStatus,
  isPushSupported,
  subscribeToPlannerPush,
  unsubscribeFromPlannerPush,
} from '~/lib/planner/push-client';

type Props = {
  className?: string;
};

export function PlannerRemindersToggle({ className }: Props) {
  const supported = isPushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [loading, setLoading] = useState(supported);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    void fetchPushStatus().then((status) => {
      if (cancelled) return;
      if (status) {
        setSubscribed(status.subscribed && status.enabled);
        setLeadMinutes(status.leadMinutes);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  function handleToggle() {
    startTransition(async () => {
      try {
        if (subscribed) {
          await unsubscribeFromPlannerPush();
          setSubscribed(false);
          toast.success('Schedule reminders turned off');
          return;
        }

        await subscribeToPlannerPush(leadMinutes);
        setSubscribed(true);
        toast.success(
          `Reminders on — we'll notify you ~${leadMinutes} min before each block`,
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not update reminders',
        );
      }
    });
  }

  if (!supported) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={loading || isPending}
        className="h-9 border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
      >
        {loading || isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <Bell className="mr-1.5 h-4 w-4 text-[#5eead4]" />
        ) : (
          <BellOff className="mr-1.5 h-4 w-4" />
        )}
        {subscribed ? 'Reminders on' : 'Remind me'}
      </Button>

      {subscribed ? (
        <label className="flex items-center gap-1.5 text-xs text-white/45">
          <span>Lead time</span>
          <select
            value={leadMinutes}
            disabled={isPending}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setLeadMinutes(next);
              startTransition(async () => {
                try {
                  await subscribeToPlannerPush(next);
                  toast.success(`Lead time set to ${next} minutes`);
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : 'Could not update lead time',
                  );
                }
              });
            }}
            className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white outline-none"
          >
            {[5, 10, 15, 30].map((value) => (
              <option key={value} value={value} className="bg-[#0F1B35]">
                {value} min
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
