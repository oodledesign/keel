import { z } from 'zod';

export const igDmFlowButtonSchema = z.object({
  label: z.string().min(1).max(20),
  type: z.enum(['postback', 'url']),
  url: z.string().url().optional(),
});

export const igDmFlowStepSchema = z.object({
  id: z.string().min(1).max(64),
  message: z.string().min(1).max(1000),
  buttons: z.array(igDmFlowButtonSchema).min(1).max(3),
});

export const igDmFlowConfigSchema = z
  .object({
    steps: z.array(igDmFlowStepSchema).min(1).max(5),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const step of data.steps) {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate step id: ${step.id}`,
          path: ['steps'],
        });
        return;
      }
      ids.add(step.id);
      for (const btn of step.buttons) {
        if (btn.type === 'url' && !btn.url) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'URL buttons require a url',
            path: ['steps'],
          });
          return;
        }
      }
    }
    const last = data.steps[data.steps.length - 1];
    const hasUrl = last?.buttons.some((b) => b.type === 'url');
    if (!hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Final step must include a link (URL) button',
        path: ['steps'],
      });
    }
    const nonLastPostbacks = data.steps.slice(0, -1).every((step) =>
      step.buttons.some((b) => b.type === 'postback'),
    );
    if (data.steps.length > 1 && !nonLastPostbacks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each step before the last needs a postback button',
        path: ['steps'],
      });
    }
  });

export type IgDmFlowButton = z.infer<typeof igDmFlowButtonSchema>;
export type IgDmFlowStep = z.infer<typeof igDmFlowStepSchema>;
export type IgDmFlowConfig = z.infer<typeof igDmFlowConfigSchema>;

export const DEFAULT_IG_DM_FLOW: IgDmFlowConfig = {
  steps: [
    {
      id: 'confirm',
      message:
        "Hey! How's it going? I saw you're interested — want us to send it here?",
      buttons: [{ label: 'Yes please', type: 'postback' }],
    },
    {
      id: 'deliver',
      message: 'Great. Here you go 👇',
      buttons: [
        { label: 'Get access here', type: 'url', url: 'https://ozer.so' },
      ],
    },
  ],
};

export function parseIgDmFlow(value: unknown): IgDmFlowConfig | null {
  const parsed = igDmFlowConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildPostbackPayload(
  triggerId: string,
  fromStepId: string,
): string {
  return `igflow:${triggerId}:${fromStepId}`;
}

export function parsePostbackPayload(
  payload: string,
): { triggerId: string; fromStepId: string } | null {
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== 'igflow') return null;
  const triggerId = parts[1];
  const fromStepId = parts[2];
  if (!triggerId || !fromStepId) return null;
  return { triggerId, fromStepId };
}

export function getNextFlowStep(
  flow: IgDmFlowConfig,
  fromStepId: string,
): IgDmFlowStep | null {
  const idx = flow.steps.findIndex((s) => s.id === fromStepId);
  if (idx < 0 || idx >= flow.steps.length - 1) return null;
  return flow.steps[idx + 1] ?? null;
}

export function getFlowEntryStep(flow: IgDmFlowConfig): IgDmFlowStep {
  return flow.steps[0]!;
}
