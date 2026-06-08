import type { KeelMcpToolRegistrar } from './types.js';
import { registerClientTools } from './clients.js';
import { registerNoteTools } from './notes.js';
import { registerPipelineTools } from './pipeline.js';
import { registerProjectTools } from './projects.js';
import { registerTaskTools } from './tasks.js';

export const keelMcpTools: KeelMcpToolRegistrar[] = [
  registerTaskTools,
  registerProjectTools,
  registerPipelineTools,
  registerClientTools,
  registerNoteTools,
];
