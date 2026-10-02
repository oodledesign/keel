'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type ProjectAuditEntityType,
  listProjectAuditLog,
} from './project-audit.service';

export const listProjectAuditLogAction = enhanceAction(
  async (input: {
    accountId: string;
    projectId?: string;
    entityType?: ProjectAuditEntityType;
    limit?: number;
    offset?: number;
  }) => {
    const client = getSupabaseServerClient();
    return listProjectAuditLog(client, input);
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
      entityType: z
        .enum(['task', 'project', 'phase', 'note', 'guest'])
        .optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }),
  },
);
