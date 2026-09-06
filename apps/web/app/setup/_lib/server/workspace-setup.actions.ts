'use server';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  type WorkspaceSetupResult,
  type WorkspaceSetupSelection,
  completeWorkspaceSetupForUser,
} from './workspace-setup.service';

export type { WorkspaceSetupResult, WorkspaceSetupSelection };

export async function completeWorkspaceSetup(
  selections: WorkspaceSetupSelection[],
  options?: {
    billingIntent?: {
      productId: string;
      planId: string;
      interval?: 'month' | 'year';
      seats?: number;
    };
    skipTeamWorkspaces?: boolean;
  },
): Promise<WorkspaceSetupResult> {
  const user = await requireUserInServerComponent();
  return completeWorkspaceSetupForUser(user.id, selections, options);
}
