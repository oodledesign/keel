'use client';

import { useState } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react';

const BRAND = {
  oodle: '#4F46E5',
  greentrees: '#059669',
} as const;

type Ticket = {
  id: string;
  title: string;
  clientName: string;
  raisedBy: string;
  assignedTo: string;
  type: 'bug' | 'request' | 'question' | 'feedback';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  business: 'oodle' | 'greentrees';
  createdAt: string;
  lastActivity: string;
};

const PLACEHOLDER_TICKETS: Ticket[] = [
  { id: 'TK-001', title: 'Logo files not rendering on print', clientName: 'Meadow & Co', raisedBy: 'Sarah Mitchell', assignedTo: 'Dan', type: 'bug', status: 'open', priority: 'high', business: 'oodle', createdAt: '2 hours ago', lastActivity: '30 min ago' },
  { id: 'TK-002', title: 'Need additional colour variants', clientName: 'Chapman Creative', raisedBy: 'Lucy Chapman', assignedTo: 'Dan', type: 'request', status: 'in_progress', priority: 'medium', business: 'oodle', createdAt: 'Yesterday', lastActivity: '4 hours ago' },
  { id: 'TK-003', title: 'Bathroom tile query — unit 3', clientName: 'Harbourview Homes', raisedBy: 'David Moss', assignedTo: 'Dan', type: 'question', status: 'open', priority: 'medium', business: 'greentrees', createdAt: 'Yesterday', lastActivity: 'Yesterday' },
  { id: 'TK-004', title: 'Slow loading on client portal', clientName: 'Barton Developments', raisedBy: 'James Barton', assignedTo: 'Dan', type: 'bug', status: 'in_progress', priority: 'urgent', business: 'greentrees', createdAt: '3 days ago', lastActivity: '1 hour ago' },
  { id: 'TK-005', title: 'Request to add more gallery photos', clientName: 'Price Bakery', raisedBy: 'Hannah Price', assignedTo: 'Dan', type: 'request', status: 'open', priority: 'low', business: 'oodle', createdAt: '4 days ago', lastActivity: '2 days ago' },
  { id: 'TK-006', title: 'Positive feedback on rebrand', clientName: 'Ivy Studio', raisedBy: 'Rachel Green', assignedTo: 'Dan', type: 'feedback', status: 'resolved', priority: 'low', business: 'oodle', createdAt: '1 week ago', lastActivity: '5 days ago' },
];

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-500/15 text-blue-400 border-blue-500/40', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/15 text-amber-400 border-amber-500/40', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40', icon: CheckCircle2 },
} as const;

const typeLabels: Record<Ticket['type'], string> = {
  bug: 'Bug',
  request: 'Request',
  question: 'Question',
  feedback: 'Feedback',
};

const priorityColors = {
  low: 'text-zinc-400',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  urgent: 'text-rose-400',
};

export default function SupportPage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [search, setSearch] = useState('');

  const filtered = PLACEHOLDER_TICKETS.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = PLACEHOLDER_TICKETS.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Support</h1>
          <p className="mt-1 text-sm text-zinc-400">{openCount} open tickets</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#4ab86f]"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="h-10 w-full rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-white/16 focus:outline-none"
          />
        </div>
        <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
          {(['all', 'open', 'in_progress', 'resolved'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                filter === f ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-6 py-12 text-center text-sm text-zinc-500">
            No tickets match your filters
          </div>
        ) : (
          filtered.map((ticket) => {
            const cfg = statusConfig[ticket.status];
            const StatusIcon = cfg.icon;
            return (
              <div
                key={ticket.id}
                className="group rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-5 transition-colors hover:border-white/10"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${ticket.status === 'open' ? 'text-blue-400' : ticket.status === 'in_progress' ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{ticket.id}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className={`text-[11px] font-medium ${priorityColors[ticket.priority]}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white">{ticket.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: ticket.business === 'oodle' ? BRAND.oodle : BRAND.greentrees }}
                          />
                          {ticket.clientName}
                        </span>
                        <span>·</span>
                        <span>{typeLabels[ticket.type]}</span>
                        <span>·</span>
                        <span>Raised {ticket.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {ticket.lastActivity}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
