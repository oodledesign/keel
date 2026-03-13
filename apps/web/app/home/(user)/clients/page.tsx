'use client';

import { useState } from 'react';

import {
  Building2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
} from 'lucide-react';

const BRAND = {
  oodle: '#4F46E5',
  greentrees: '#059669',
} as const;

type Client = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  business: 'oodle' | 'greentrees';
  stage: string;
  projectCount: number;
  openTickets: number;
};

const PLACEHOLDER_CLIENTS: Client[] = [
  { id: '1', name: 'Meadow & Co', contactName: 'Sarah Mitchell', email: 'sarah@meadowco.com', phone: '07700 900123', business: 'oodle', stage: 'Active', projectCount: 2, openTickets: 0 },
  { id: '2', name: 'Harbourview Homes', contactName: 'David Moss', email: 'david@harbourview.co.uk', phone: '07700 900456', business: 'greentrees', stage: 'Active', projectCount: 1, openTickets: 1 },
  { id: '3', name: 'Chapman Creative', contactName: 'Lucy Chapman', email: 'lucy@chapmancreative.com', phone: '07700 900789', business: 'oodle', stage: 'Proposal', projectCount: 0, openTickets: 0 },
  { id: '4', name: 'Riverside Development', contactName: 'Mark Lewis', email: 'mark@riversidedev.co.uk', phone: '07700 900321', business: 'greentrees', stage: 'Active', projectCount: 3, openTickets: 0 },
  { id: '5', name: 'Ivy Studio', contactName: 'Rachel Green', email: 'rachel@ivystudio.co.uk', phone: '07700 900654', business: 'oodle', stage: 'Lead', projectCount: 0, openTickets: 0 },
  { id: '6', name: 'Barton Developments', contactName: 'James Barton', email: 'james@bartondev.co.uk', phone: '07700 900987', business: 'greentrees', stage: 'Active', projectCount: 2, openTickets: 1 },
  { id: '7', name: 'Price Bakery', contactName: 'Hannah Price', email: 'hannah@pricebakery.com', phone: '07700 900111', business: 'oodle', stage: 'Active', projectCount: 1, openTickets: 1 },
  { id: '8', name: 'Reeves & Partners', contactName: 'Anna Reeves', email: 'anna@reeves.co.uk', phone: '07700 900222', business: 'oodle', stage: 'Negotiation', projectCount: 0, openTickets: 0 },
];

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

const stageColors: Record<string, string> = {
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Lead: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  Proposal: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  Negotiation: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
};

export default function ClientsPage() {
  const [filter, setFilter] = useState<'all' | 'oodle' | 'greentrees'>('all');
  const [search, setSearch] = useState('');

  const filtered = PLACEHOLDER_CLIENTS.filter((c) => {
    if (filter !== 'all' && c.business !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.contactName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 bg-transparent px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Clients</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {PLACEHOLDER_CLIENTS.length} clients across both businesses
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#4ab86f]"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="h-10 w-full rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-white/16 focus:outline-none"
          />
        </div>
        <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
          {(['all', 'oodle', 'greentrees'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                filter === f ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'oodle' ? 'Oodle' : 'Greentrees'}
            </button>
          ))}
        </div>
      </div>

      {/* Client cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => (
          <div key={client.id} className={panelClass}>
            <div className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                    style={{
                      backgroundColor: `${client.business === 'oodle' ? BRAND.oodle : BRAND.greentrees}22`,
                      color: client.business === 'oodle' ? BRAND.oodle : BRAND.greentrees,
                    }}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{client.name}</p>
                    <p className="text-xs text-zinc-400">{client.contactName}</p>
                  </div>
                </div>
                <button type="button" className="text-zinc-500 hover:text-zinc-300">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${stageColors[client.stage] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40'}`}>
                  {client.stage}
                </span>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: client.business === 'oodle' ? BRAND.oodle : BRAND.greentrees }}
                />
                <span className="text-xs text-zinc-500">
                  {client.business === 'oodle' ? 'Oodle Design' : 'Greentrees Homes'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/6 bg-[var(--workspace-shell-canvas)] px-3 py-2">
                  <p className="text-zinc-500">Projects</p>
                  <p className="text-sm font-semibold text-white">{client.projectCount}</p>
                </div>
                <div className="rounded-lg border border-white/6 bg-[var(--workspace-shell-canvas)] px-3 py-2">
                  <p className="text-zinc-500">Open Tickets</p>
                  <p className="text-sm font-semibold text-white">{client.openTickets}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 border-t border-white/6 pt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {client.email}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
