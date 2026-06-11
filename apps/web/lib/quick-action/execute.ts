import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { verifyQuickActionToken } from './action-token';
import { executeCreateTask } from './tools/execute-create-task';
import { executePagespeedScan } from './tools/execute-pagespeed';
import type { QuickActionExecuteResponse } from './types';

export async function executeQuickAction(
  client: SupabaseClient,
  userId: string,
  actionToken: string,
): Promise<QuickActionExecuteResponse> {
  const payload = verifyQuickActionToken(actionToken);

  if (payload.userId !== userId) {
    throw new Error('Action token does not belong to this user');
  }

  if (payload.data.type === 'create_task') {
    const result = await executeCreateTask(client, userId, payload.data);
    return {
      success: true,
      message: result.message,
      link: result.link,
      entityId: result.entityId,
    };
  }

  if (payload.data.type === 'pagespeed_scan') {
    const result = await executePagespeedScan(client, userId, payload.data);
    return {
      success: true,
      message: result.message,
      link: result.link,
      entityId: result.entityId,
    };
  }

  throw new Error('Unsupported action type');
}
