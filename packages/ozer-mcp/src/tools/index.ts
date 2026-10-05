import { registerAssigneeTools } from './assignees';
import { registerCanvasTools } from './canvas';
import { registerCanvasCardTools } from './canvas-cards';
import { registerCirculationTools } from './circulation';
import { registerClientTools } from './clients';
import { registerCommercialMatchingTools } from './commercial-matching';
import { registerContactTools } from './contacts';
import { registerContentTools } from './content';
import { registerExtractTaskTools } from './extract-tasks';
import { registerMeetingTools } from './meetings';
import { registerNoteTools } from './notes';
import { registerPhaseTools } from './phases';
import { registerPipelineTools } from './pipeline';
import { registerProjectTools } from './projects';
import { registerPropertyWorkspaceTools } from './property-workspaces';
import { registerRecurringTools } from './recurring';
import { registerTaskTools } from './tasks';
import { registerTodayDigestTools } from './today-digest';
import type { OzerMcpToolRegistrar } from './types';
import { registerWorkspaceTools } from './workspaces';

export const ozerMcpTools: OzerMcpToolRegistrar[] = [
  registerWorkspaceTools,
  registerTodayDigestTools,
  registerTaskTools,
  registerAssigneeTools,
  registerExtractTaskTools,
  registerProjectTools,
  registerPhaseTools,
  registerContentTools,
  registerCanvasTools,
  registerCanvasCardTools,
  registerRecurringTools,
  registerPipelineTools,
  registerPropertyWorkspaceTools,
  registerCommercialMatchingTools,
  registerCirculationTools,
  registerClientTools,
  registerContactTools,
  registerMeetingTools,
  registerNoteTools,
];
