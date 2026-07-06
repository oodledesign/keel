import type { OzerMcpToolRegistrar } from './types';
import { registerClientTools } from './clients';
import { registerNoteTools } from './notes';
import { registerPipelineTools } from './pipeline';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';

export const ozerMcpTools: OzerMcpToolRegistrar[] = [
  registerTaskTools,
  registerProjectTools,
  registerPipelineTools,
  registerClientTools,
  registerNoteTools,
];
