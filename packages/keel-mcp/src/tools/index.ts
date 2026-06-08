import type { KeelMcpToolRegistrar } from './types';
import { registerClientTools } from './clients';
import { registerNoteTools } from './notes';
import { registerPipelineTools } from './pipeline';
import { registerProjectTools } from './projects';
import { registerTaskTools } from './tasks';

export const keelMcpTools: KeelMcpToolRegistrar[] = [
  registerTaskTools,
  registerProjectTools,
  registerPipelineTools,
  registerClientTools,
  registerNoteTools,
];
