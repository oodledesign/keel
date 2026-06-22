'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Bell, CircleAlert, Info, TriangleAlert, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@kit/ui/button';
import { If } from '@kit/ui/if';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { Separator } from '@kit/ui/separator';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import { useDismissNotification, useFetchNotifications } from '../hooks';
import { Notification } from '../types';

export function NotificationsPopover(params: {
  realtime: boolean;
  accountIds: string[];
  onClick?: (notification: Notification) => void;
  shouldSurfaceNotification?: (
    notification: Notification,
  ) => boolean | Promise<boolean>;
  onNotificationSuppressed?: (
    notification: Notification,
  ) => void | Promise<void>;
}) {
  const { i18n, t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState<
    Notification[]
  >([]);
  const [silencedNotifications, setSilencedNotifications] = useState<
    Notification[]
  >([]);
  const [showSilencedNotifications, setShowSilencedNotifications] =
    useState(false);

  const handleIncoming = useCallback(
    async (incoming: Notification[]) => {
      const nextActive: Notification[] = [];
      const nextSilenced: Notification[] = [];

      for (const notification of incoming) {
        if (notification.muted) {
          nextSilenced.push(notification);
          continue;
        }

        const shouldSurface = params.shouldSurfaceNotification
          ? await params.shouldSurfaceNotification(notification)
          : true;

        if (!shouldSurface) {
          nextSilenced.push(notification);
          await params.onNotificationSuppressed?.(notification);
          continue;
        }

        nextActive.push(notification);
      }

      if (nextActive.length > 0) {
        setActiveNotifications((existing) => {
          const unique = new Set(existing.map((row) => row.id));
          const filtered = nextActive.filter((row) => !unique.has(row.id));
          return [...filtered, ...existing];
        });
      }

      if (nextSilenced.length > 0) {
        setSilencedNotifications((existing) => {
          const unique = new Set(existing.map((row) => row.id));
          const filtered = nextSilenced.filter((row) => !unique.has(row.id));
          return [...filtered, ...existing];
        });
      }
    },
    [params],
  );

  const dismissNotification = useDismissNotification();

  useFetchNotifications({
    onNotifications: handleIncoming,
    accountIds: params.accountIds,
    realtime: params.realtime,
    includeMuted: true,
  });

  const visibleNotifications = useMemo(() => {
    if (showSilencedNotifications) {
      return [...activeNotifications, ...silencedNotifications];
    }

    return activeNotifications;
  }, [
    activeNotifications,
    silencedNotifications,
    showSilencedNotifications,
  ]);

  const badgeCount = activeNotifications.length;

  const timeAgo = (createdAt: string) => {
    const date = new Date(createdAt);

    let time: number;

    const daysAgo = Math.floor(
      (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    const formatter = new Intl.RelativeTimeFormat(i18n.language, {
      numeric: 'auto',
    });

    if (daysAgo < 1) {
      time = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60));

      if (time < 5) {
        return t('common:justNow');
      }

      if (time < 60) {
        return formatter.format(-time, 'minute');
      }

      const hours = Math.floor(time / 60);

      return formatter.format(-hours, 'hour');
    }

    const unit = (() => {
      const minutesAgo = Math.floor(
        (new Date().getTime() - date.getTime()) / (1000 * 60),
      );

      if (minutesAgo <= 60) {
        return 'minute';
      }

      if (daysAgo <= 1) {
        return 'hour';
      }

      if (daysAgo <= 30) {
        return 'day';
      }

      if (daysAgo <= 365) {
        return 'month';
      }

      return 'year';
    })();

    const text = formatter.format(-daysAgo, unit);

    return text.slice(0, 1).toUpperCase() + text.slice(1);
  };

  useEffect(() => {
    return () => {
      setActiveNotifications([]);
      setSilencedNotifications([]);
    };
  }, []);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className={'relative h-9 w-9'} variant={'ghost'}>
          <Bell className={'min-h-4 min-w-4'} />

          <span
            className={cn(
              `fade-in animate-in zoom-in absolute top-1 right-1 mt-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[0.65rem] text-white`,
              {
                hidden: !badgeCount,
              },
            )}
          >
            {badgeCount}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={
          'flex w-full max-w-96 flex-col border-white/10 bg-[var(--workspace-shell-panel)] p-0 text-white lg:min-w-64'
        }
        align={'start'}
        collisionPadding={20}
        sideOffset={10}
      >
        <div className={'flex items-center justify-between gap-3 px-3 py-2'}>
          <div className={'text-sm font-semibold'}>{t('common:notifications')}</div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Show silenced</span>
            <Switch
              checked={showSilencedNotifications}
              onCheckedChange={setShowSilencedNotifications}
            />
          </label>
        </div>

        <Separator />

        <If condition={!visibleNotifications.length}>
          <div className={'px-3 py-2 text-sm'}>
            {t('common:noNotifications')}
          </div>
        </If>

        <div
          className={
            'flex max-h-[min(60dvh,calc(100dvh-8rem))] flex-col divide-y divide-white/10 overflow-y-auto overscroll-contain'
          }
        >
          {showSilencedNotifications && silencedNotifications.length > 0 ? (
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              While you were away
            </div>
          ) : null}

          {visibleNotifications.map((notification) => {
            const isSilenced = silencedNotifications.some(
              (row) => row.id === notification.id,
            );
            const maxChars = 100;

            let body = t(notification.body, {
              defaultValue: notification.body,
            });

            if (body.length > maxChars) {
              body = body.substring(0, maxChars) + '...';
            }

            const Icon = () => {
              switch (notification.type) {
                case 'warning':
                  return <TriangleAlert className={'h-4 text-yellow-500'} />;
                case 'error':
                  return <CircleAlert className={'text-destructive h-4'} />;
                default:
                  return <Info className={'h-4 text-blue-500'} />;
              }
            };

            return (
              <div
                key={notification.id.toString()}
                className={cn(
                  'flex min-h-18 flex-col items-start justify-center gap-y-1 px-3 py-2',
                  isSilenced && 'bg-white/[0.03] opacity-70',
                )}
                onClick={() => {
                  if (params.onClick) {
                    params.onClick(notification);
                  }
                }}
              >
                <div className={'flex w-full items-start justify-between'}>
                  <div
                    className={'flex items-start justify-start gap-x-3 py-2'}
                  >
                    <div className={'py-0.5'}>
                      <Icon />
                    </div>

                    <div className={'flex flex-col space-y-1'}>
                      <div className={'text-sm'}>
                        <If condition={notification.link} fallback={body}>
                          {(link) => (
                            <a href={link} className={'hover:underline'}>
                              {body}
                            </a>
                          )}
                        </If>
                      </div>

                      <span className={'text-muted-foreground text-xs'}>
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className={'py-2'}>
                    <Button
                      className={'max-h-6 max-w-6'}
                      size={'icon'}
                      variant={'ghost'}
                      onClick={() => {
                        setActiveNotifications((existing) =>
                          existing.filter((row) => row.id !== notification.id),
                        );
                        setSilencedNotifications((existing) =>
                          existing.filter((row) => row.id !== notification.id),
                        );

                        return dismissNotification(notification.id);
                      }}
                    >
                      <XIcon className={'h-3'} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
