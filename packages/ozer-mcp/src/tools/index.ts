import { registerClientTools } from './clients';
import { registerNoteTools } from './notes';
import { registerPipelineTools } from './pipeline';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';
import type { OzerMcpToolRegistrar } from './types';

export const ozerMcpTools: OzerMcpToolRegistrar[] = [
  registerTaskTools,
  registerProjectTools,
  registerPipelineTools,
  registerClientTools,
  registerNoteTools,
];
