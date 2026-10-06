'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import {
  type CanvasItem,
  canvasItemFromRow,
  isCanvasItemKind,
} from '~/lib/projects/canvas/canvas-types';

export type CanvasPeer = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  color: string;
};

export type CanvasCursor = CanvasPeer & { x: number; y: number; at: number };

export type CanvasRemoteDrag = {
  userId: string;
  x: number;
  y: number;
  at: number;
};

type Position = { id: string; x: number; y: number };

const PEER_COLORS = [
  '#FF5C34',
  '#2563EB',
  '#16A34A',
  '#7C3AED',
  '#DB2777',
  '#CA8A04',
  '#0891B2',
  '#EA580C',
];

const LIVE_THROTTLE_MS = 40;
/** Fallback poll while Realtime is down. */
const RESYNC_INTERVAL_MS = 30_000;
/** Safety net while Realtime is healthy — events already keep us current. */
const RESYNC_CONNECTED_INTERVAL_MS = 5 * 60_000;
/** Returning to the tab only resyncs if we were away at least this long. */
const RESYNC_AWAY_MS = 20_000;
const LINKED_DEBOUNCE_MS = 1_500;
const CURSOR_TTL_MS = 10_000;
const DRAG_TTL_MS = 3_000;
/** Keeps broadcast messages well under the Realtime payload limit. */
const BROADCAST_ITEMS_CHUNK = 40;

export function canvasPeerColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length]!;
}

function isCanvasItemLike(value: unknown): value is CanvasItem {
  const item = value as Partial<CanvasItem> | null;
  return (
    !!item &&
    typeof item.id === 'string' &&
    isCanvasItemKind(item.kind) &&
    typeof item.x === 'number' &&
    typeof item.y === 'number' &&
    typeof item.updatedAt === 'string'
  );
}

/**
 * Live collaboration for a project canvas:
 * - private broadcast/presence channel for who's here, cursors, in-flight
 *   drags and instant item fan-out after our own writes;
 * - postgres_changes for canvas item inserts/updates plus tasks/phases
 *   (linked cards). DELETE events can't be filtered by project, so item
 *   deletes arrive via broadcast and resync only;
 * - periodic resync as a fallback when Realtime is unavailable.
 */
export function useProjectCanvasRealtime(params: {
  projectId: string;
  me: { userId: string; name: string; pictureUrl: string | null } | null;
  onRemoteItems: (items: CanvasItem[]) => void;
  onRemoteDeletes: (ids: string[]) => void;
  onLinkedDataChanged: () => void;
  onResync: () => void;
}) {
  const { projectId, me } = params;
  const supabase = useSupabase();

  const handlersRef = useRef(params);
  handlersRef.current = params;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef<Record<string, number>>({});
  const trailingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<CanvasPeer[]>([]);
  const [cursors, setCursors] = useState<Record<string, CanvasCursor>>({});
  const [remoteDrags, setRemoteDrags] = useState<
    Record<string, CanvasRemoteDrag>
  >({});

  const meId = me?.userId ?? null;
  const meName = me?.name ?? '';
  const mePicture = me?.pictureUrl ?? null;

  useEffect(() => {
    if (!meId) return;

    let cancelled = false;
    const channel = supabase.channel(`project-canvas:${projectId}`, {
      config: {
        private: true,
        presence: { key: meId },
        broadcast: { self: false },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<CanvasPeer>();
        const list = Object.values(state)
          .map((entries) => entries[0])
          .filter(
            (peer): peer is CanvasPeer & { presence_ref: string } =>
              !!peer && peer.userId !== meId,
          )
          .map(({ userId, name, pictureUrl, color }) => ({
            userId,
            name,
            pictureUrl,
            color,
          }));
        setPeers(list);
        const here = new Set(list.map((peer) => peer.userId));
        setCursors((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([userId]) => here.has(userId)),
          ),
        );
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursor = payload as Omit<CanvasCursor, 'at'>;
        if (!cursor?.userId || typeof cursor.x !== 'number') return;
        setCursors((prev) => ({
          ...prev,
          [cursor.userId]: { ...cursor, at: Date.now() },
        }));
      })
      .on('broadcast', { event: 'cursor-leave' }, ({ payload }) => {
        const userId = (payload as { userId?: string })?.userId;
        if (!userId) return;
        setCursors((prev) => {
          const { [userId]: _gone, ...rest } = prev;
          return rest;
        });
      })
      .on('broadcast', { event: 'drag' }, ({ payload }) => {
        const { userId, positions } = payload as {
          userId?: string;
          positions?: Position[];
        };
        if (!userId || !Array.isArray(positions)) return;
        const at = Date.now();
        setRemoteDrags((prev) => {
          const next = { ...prev };
          for (const position of positions) {
            next[position.id] = { userId, x: position.x, y: position.y, at };
          }
          return next;
        });
      })
      .on('broadcast', { event: 'drag-end' }, ({ payload }) => {
        const ids = (payload as { ids?: string[] })?.ids;
        if (!Array.isArray(ids)) return;
        setRemoteDrags((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
      })
      .on('broadcast', { event: 'items' }, ({ payload }) => {
        const items = (payload as { items?: unknown[] })?.items;
        if (!Array.isArray(items)) return;
        handlersRef.current.onRemoteItems(items.filter(isCanvasItemLike));
      })
      .on('broadcast', { event: 'deletes' }, ({ payload }) => {
        const ids = (payload as { ids?: unknown[] })?.ids;
        if (!Array.isArray(ids)) return;
        handlersRef.current.onRemoteDeletes(
          ids.filter((id): id is string => typeof id === 'string'),
        );
      })
      .on('broadcast', { event: 'linked' }, () => {
        handlersRef.current.onLinkedDataChanged();
      });

    void (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        // Falls back to the anon token; the private channel will then be refused.
      }
      if (cancelled) return;
      channelRef.current = channel;
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          void channel.track({
            userId: meId,
            name: meName,
            pictureUrl: mePicture,
            color: canvasPeerColor(meId),
          });
        } else {
          setConnected(false);
        }
      });
    })();

    const trailing = trailingRef.current;
    return () => {
      cancelled = true;
      for (const timer of Object.values(trailing)) clearTimeout(timer);
      channelRef.current = null;
      setConnected(false);
      setPeers([]);
      setCursors({});
      setRemoteDrags({});
      void supabase.removeChannel(channel);
    };
  }, [meId, meName, mePicture, projectId, supabase]);

  useEffect(() => {
    let linkedTimer: ReturnType<typeof setTimeout> | undefined;
    const linkedChanged = () => {
      clearTimeout(linkedTimer);
      linkedTimer = setTimeout(
        () => handlersRef.current.onLinkedDataChanged(),
        LINKED_DEBOUNCE_MS,
      );
    };
    const projectFilter = `project_id=eq.${projectId}`;
    const itemChanged = (payload: { new: Record<string, unknown> }) => {
      if (payload.new?.id && isCanvasItemKind(payload.new.kind)) {
        handlersRef.current.onRemoteItems([canvasItemFromRow(payload.new)]);
      }
    };

    const channel = supabase
      .channel(`project-canvas-db:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_canvas_items',
          filter: projectFilter,
        },
        itemChanged,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_canvas_items',
          filter: projectFilter,
        },
        itemChanged,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: projectFilter },
        linkedChanged,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_phases',
          filter: projectFilter,
        },
        linkedChanged,
      )
      .subscribe();

    return () => {
      clearTimeout(linkedTimer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const resyncIfVisible = () => {
      if (document.visibilityState === 'visible') {
        handlersRef.current.onResync();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? Infinity : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= RESYNC_AWAY_MS) resyncIfVisible();
    };
    const interval = setInterval(
      resyncIfVisible,
      connected ? RESYNC_CONNECTED_INTERVAL_MS : RESYNC_INTERVAL_MS,
    );
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [connected]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const entries = Object.entries(prev);
        const fresh = entries.filter(([, c]) => now - c.at < CURSOR_TTL_MS);
        return fresh.length === entries.length
          ? prev
          : Object.fromEntries(fresh);
      });
      setRemoteDrags((prev) => {
        const entries = Object.entries(prev);
        const fresh = entries.filter(([, d]) => now - d.at < DRAG_TTL_MS);
        return fresh.length === entries.length
          ? prev
          : Object.fromEntries(fresh);
      });
    }, 2_000);
    return () => clearInterval(interval);
  }, []);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>, throttleMs = 0) => {
      const channel = channelRef.current;
      if (!channel || !connected) return;

      const fire = () => {
        lastSentRef.current[event] = Date.now();
        delete trailingRef.current[event];
        void channelRef.current?.send({ type: 'broadcast', event, payload });
      };

      clearTimeout(trailingRef.current[event]);
      if (!throttleMs) {
        fire();
        return;
      }
      const elapsed = Date.now() - (lastSentRef.current[event] ?? 0);
      if (elapsed >= throttleMs) fire();
      else trailingRef.current[event] = setTimeout(fire, throttleMs - elapsed);
    },
    [connected],
  );

  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      if (!meId) return;
      send(
        'cursor',
        {
          userId: meId,
          name: meName,
          pictureUrl: mePicture,
          color: canvasPeerColor(meId),
          x,
          y,
        },
        LIVE_THROTTLE_MS,
      );
    },
    [meId, meName, mePicture, send],
  );

  const broadcastCursorLeave = useCallback(() => {
    if (meId) send('cursor-leave', { userId: meId });
  }, [meId, send]);

  const broadcastDrag = useCallback(
    (positions: Position[]) => {
      if (meId && positions.length > 0) {
        send('drag', { userId: meId, positions }, LIVE_THROTTLE_MS);
      }
    },
    [meId, send],
  );

  const broadcastDragEnd = useCallback(
    (ids: string[]) => {
      clearTimeout(trailingRef.current.drag);
      delete trailingRef.current.drag;
      if (ids.length > 0) send('drag-end', { ids });
    },
    [send],
  );

  const broadcastItems = useCallback(
    (items: CanvasItem[]) => {
      for (let i = 0; i < items.length; i += BROADCAST_ITEMS_CHUNK) {
        send('items', { items: items.slice(i, i + BROADCAST_ITEMS_CHUNK) });
      }
    },
    [send],
  );

  const broadcastDeletes = useCallback(
    (ids: string[]) => {
      if (ids.length > 0) send('deletes', { ids });
    },
    [send],
  );

  const broadcastLinkedChanged = useCallback(() => send('linked', {}), [send]);

  return {
    connected,
    peers,
    cursors,
    remoteDrags,
    broadcastCursor,
    broadcastCursorLeave,
    broadcastDrag,
    broadcastDragEnd,
    broadcastItems,
    broadcastDeletes,
    broadcastLinkedChanged,
  };
}
