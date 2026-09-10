import { registerClientTools } from './clients';
import { registerContactTools } from './contacts';
import { registerExtractTaskTools } from './extract-tasks';
import { registerMeetingTools } from './meetings';
import { registerNoteTools } from './notes';
import { registerPipelineTools } from './pipeline';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';
import { registerTodayDigestTools } from './today-digest';
import type { OzerMcpToolRegistrar } from './types';
import { registerWorkspaceTools } from './workspaces';

export const ozerMcpTools: OzerMcpToolRegistrar[] = [
  registerWorkspaceTools,
  registerTodayDigestTools,
  registerTaskTools,
  registerExtractTaskTools,
  registerProjectTools,
  registerPipelineTools,
  registerClientTools,
  registerContactTools,
  registerMeetingTools,
  registerNoteTools,
];
