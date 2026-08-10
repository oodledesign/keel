'use client';

import {
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { SupportPartyIdentity } from '~/components/support/support-party-identity';
import pathsConfig from '~/config/paths.config';

import type { TicketStatus } from '../_lib/schema/support-tickets.schema';
import { updateSupportTicket } from '../_lib/server/server-actions';
import type { SupportTicket } from '../_lib/server/support-tickets.service';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  formatTicketNumber,
} from './support-ticket-badges';

const STATUSES: { key: TicketStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'pending_credits', label: 'Pending credits' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const panelClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]';

type Props = {
  accountSlug: string;
  accountId: string;
  tickets: SupportTicket[];
};

export function SupportTicketsBoard({
  accountSlug,
  accountId,
  tickets: initialTickets,
}: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const ticketsByStatus = useMemo(() => {
    const map = new Map<TicketStatus, SupportTicket[]>();
    for (const status of STATUSES) {
      map.set(status.key, []);
    }
    for (const ticket of tickets) {
      const list = map.get(ticket.status);
      if (list) {
        list.push(ticket);
      } else {
        map.set(ticket.status, [ticket]);
      }
    }
    return map;
  }, [tickets]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const ticket = tickets.find((t) => t.id === event.active.id);
      setActiveTicket(ticket ?? null);
    },
    [tickets],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTicket(null);
      const { active, over } = event;
      if (!over) return;

      const ticketId = active.id as string;
      const overId = over.id as string;
      const overStatus = (over.data.current as { status?: TicketStatus })
        ?.status;

      let newStatus: TicketStatus | null = null;

      if (overStatus) {
        newStatus = overStatus;
      } else if (overId.startsWith('status-')) {
        newStatus = overId.replace('status-', '') as TicketStatus;
      } else {
        const target = tickets.find((t) => t.id === overId);
        if (target) newStatus = target.status;
      }

      if (!newStatus) return;

      const current = tickets.find((t) => t.id === ticketId);
      if (!current || current.status === newStatus) return;

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus! } : t)),
      );

      startTransition(async () => {
        try {
          const updated = await updateSupportTicket({
            accountId,
            ticketId,
            status: newStatus!,
          });
          setTickets((prev) =>
            prev.map((t) => (t.id === ticketId ? updated : t)),
          );
        } catch (error) {
          console.error('[support-board] status update failed', error);
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId ? { ...t, status: current.status } : t,
            ),
          );
        }
      });
    },
    [accountId, tickets],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      {isPending ? (
        <p className="shrink-0 text-xs text-amber-400">Updating status…</p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overscroll-x-contain pb-2">
          {STATUSES.map((status) => (
            <StatusColumn
              key={status.key}
              statusKey={status.key}
              label={status.label}
              tickets={ticketsByStatus.get(status.key) ?? []}
              accountSlug={accountSlug}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket ? (
            <TicketCardBody
              ticket={activeTicket}
              accountSlug={accountSlug}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StatusColumn({
  statusKey,
  label,
  tickets,
  accountSlug,
}: {
  statusKey: TicketStatus;
  label: string;
  tickets: SupportTicket[];
  accountSlug: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${statusKey}`,
    data: { status: statusKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full max-w-[280px] min-w-[240px] flex-1 flex-col transition-colors ${
        isOver ? 'rounded-xl bg-[var(--workspace-shell-sidebar-accent)]' : ''
      }`}
    >
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          {label}
        </span>
        <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text)]/50">
          {tickets.length}
        </span>
      </div>

      <SortableContext
        items={tickets.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {tickets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-8 text-center text-xs text-[var(--workspace-shell-text)]/40">
              Drop tickets here
            </div>
          ) : (
            tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                accountSlug={accountSlug}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function TicketCard({
  ticket,
  accountSlug,
}: {
  ticket: SupportTicket;
  accountSlug: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  return (
    <TicketCardBody
      ticket={ticket}
      accountSlug={accountSlug}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function TicketCardBody({
  ticket,
  accountSlug,
  isOverlay = false,
  ref,
  style,
  dragHandleProps,
}: {
  ticket: SupportTicket;
  accountSlug: string;
  isOverlay?: boolean;
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const detailHref = pathsConfig.app.accountSupportDetail
    .replace('[account]', accountSlug)
    .replace('[id]', ticket.id);

  return (
    <div
      ref={ref}
      style={style}
      className={`${panelClass} cursor-grab p-3 active:cursor-grabbing ${
        isOverlay
          ? 'scale-105 rotate-1 shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]'
          : ''
      }`}
      {...(dragHandleProps ?? {})}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={detailHref}
          className="font-mono text-[11px] text-[var(--workspace-shell-text)]/50 hover:text-[var(--ozer-accent-muted)]"
          onClick={(event) => event.stopPropagation()}
        >
          {formatTicketNumber(ticket.ticketNumber)}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </div>
      <Link
        href={detailHref}
        className="line-clamp-2 text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
        onClick={(event) => event.stopPropagation()}
      >
        {ticket.title}
      </Link>
      {ticket.submitterName?.trim() || ticket.clientOrgName ? (
        <div className="mt-2 space-y-1.5">
          {ticket.submitterName?.trim() ? (
            <p className="truncate text-xs font-medium text-[var(--workspace-shell-text)]/70">
              {ticket.submitterName.trim()}
            </p>
          ) : null}
          {ticket.clientOrgName || ticket.businessName ? (
            <div className="flex flex-wrap items-center gap-2">
              {ticket.clientOrgName ? (
                <SupportPartyIdentity
                  party={{
                    name: ticket.clientOrgName,
                    logoUrl: ticket.clientPictureUrl,
                  }}
                  size="sm"
                  nameClassName="text-xs text-[var(--workspace-shell-text)]/60"
                />
              ) : null}
              {ticket.businessName ? (
                <SupportPartyIdentity
                  party={{
                    name: ticket.businessName,
                    logoUrl: ticket.businessLogoUrl,
                  }}
                  size="sm"
                  nameClassName="text-xs text-[var(--workspace-shell-text)]/45"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
