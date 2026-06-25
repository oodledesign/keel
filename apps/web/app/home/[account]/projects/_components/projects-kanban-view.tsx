'use client';

import Link from 'next/link';

import { LayoutGrid } from 'lucide-react';

import pathsConfig from '~/config/paths.config';
import { deliveryProjectTitle } from '~/lib/projects/project-types';
import { cn } from '@kit/ui/utils';

const STATUS_COLUMNS = [
  { key: 'pending', label: 'Planned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'completed', label: 'Complete' },
] as const;

export type ProjectsKanbanItem = {
  id: string;
  projectType: 'delivery' | 'campaign';
  status: string;
  title: string;
  clientName?: string | null;
  dueDate?: string | null;
};

export function ProjectsKanbanView({
  accountSlug,
  items,
}: {
  accountSlug: string;
  items: ProjectsKanbanItem[];
}) {
  const detailPath = (id: string) =>
    pathsConfig.app.accountProjects.replace('[account]', accountSlug) + `/${id}`;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
      {STATUS_COLUMNS.map((column) => {
        const columnItems = items.filter((item) => {
          if (item.projectType === 'campaign') {
            return column.key === 'in_progress';
          }
          if (column.key === 'completed') {
            return item.status === 'completed' || item.status === 'cancelled';
          }
          return item.status === column.key;
        });

        return (
          <section
            key={column.key}
            className="flex min-h-[280px] flex-col rounded-xl border border-white/8 bg-white/[0.02]"
          >
            <header className="border-b border-white/8 px-3 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {column.label}
                <span className="ml-2 text-zinc-600">{columnItems.length}</span>
              </h3>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {columnItems.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-zinc-600">No projects</p>
              ) : (
                columnItems.map((item) => (
                  <Link
                    key={item.id}
                    href={detailPath(item.id)}
                    className={cn(
                      'block rounded-lg border border-white/8 bg-[#111827] p-3 transition-colors hover:border-[var(--keel-teal)]/30 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {item.projectType === 'campaign' ? (
                        <LayoutGrid className="h-3.5 w-3.5 text-[#5eead4]" />
                      ) : null}
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        {item.projectType === 'campaign' ? 'Campaign' : 'Delivery'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    {item.clientName ? (
                      <p className="mt-1 text-xs text-zinc-500">{item.clientName}</p>
                    ) : null}
                    {item.dueDate ? (
                      <p className="mt-2 text-[11px] text-zinc-600">Due {item.dueDate}</p>
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function mapDeliveryRowToKanbanItem(row: Record<string, unknown>): ProjectsKanbanItem {
  const clients = row.clients as { display_name?: string | null } | null | undefined;
  return {
    id: String(row.id),
    projectType: 'delivery',
    status: String(row.status ?? 'pending'),
    title: deliveryProjectTitle(row as { title?: string | null; name?: string | null }),
    clientName: clients?.display_name ?? null,
    dueDate: (row.due_date as string | null) ?? null,
  };
}

export function mapCampaignRowToKanbanItem(row: {
  id: string;
  name: string;
}): ProjectsKanbanItem {
  return {
    id: row.id,
    projectType: 'campaign',
    status: 'in_progress',
    title: row.name,
  };
}
