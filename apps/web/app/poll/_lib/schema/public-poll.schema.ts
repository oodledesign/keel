import { z } from 'zod';

export const SubmitPollVoteSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1, 'Enter your name').max(120),
  answers: z
    .array(
      z.object({
        slotId: z.string().uuid(),
        answer: z.enum(['yes', 'if_need_be', 'no']),
      }),
    )
    .min(1)
    .max(20),
});
