import { z } from 'zod';

import {
  DISPOSALS_AI_FORMATS,
  DISPOSALS_AI_PROMPT_MAX_LENGTH,
} from '~/lib/commercial/disposals-ai-presets';

export const AskDisposalsAiSchema = z.object({
  accountId: z.string().uuid(),
  prompt: z.string().trim().min(3).max(DISPOSALS_AI_PROMPT_MAX_LENGTH),
  format: z.enum(DISPOSALS_AI_FORMATS),
});

export type AskDisposalsAiInput = z.infer<typeof AskDisposalsAiSchema>;
