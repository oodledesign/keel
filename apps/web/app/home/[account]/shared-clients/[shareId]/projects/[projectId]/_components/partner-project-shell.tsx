'use client';

import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { GuestProjectBoard } from '~/lib/projects/components/guest-project-board';
import type { PartnerCostLine } from '~/lib/projects/partner-cost-lines.service';
import type { ProjectGuestPermissions } from '~/lib/projects/project-guests.types';

import { PartnerProjectCostsPanel } from './partner-project-costs-panel';

const PARTNER_PERMISSIONS: ProjectGuestPermissions = {
  create_task: true,
  edit_own_task: true,
  comment: true,
};

export function PartnerProjectShell({
  accountSlug,
  projectId,
  ownerAccountId,
  partnerAccountId,
  shareId,
  initialTasks,
  initialCostLines,
}: {
  accountSlug: string;
  projectId: string;
  ownerAccountId: string;
  partnerAccountId: string;
  shareId: string;
  initialTasks: Array<Record<string, unknown>>;
  initialCostLines: PartnerCostLine[];
}) {
  const [tab, setTab] = useState('board');

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="h-auto gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1">
        <TabsTrigger value="board" className="text-xs">
          Board
        </TabsTrigger>
        <TabsTrigger value="costs" className="text-xs">
          Costs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="board" className="mt-0">
        <GuestProjectBoard
          projectId={projectId}
          accountId={ownerAccountId}
          permissions={PARTNER_PERMISSIONS}
          initialTasks={initialTasks}
        />
      </TabsContent>

      <TabsContent value="costs" className="mt-0">
        <PartnerProjectCostsPanel
          accountSlug={accountSlug}
          shareId={shareId}
          projectId={projectId}
          partnerAccountId={partnerAccountId}
          initialLines={initialCostLines}
        />
      </TabsContent>
    </Tabs>
  );
}
