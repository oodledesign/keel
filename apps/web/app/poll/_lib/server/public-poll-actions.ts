'use server';

import { enhanceAction } from '@kit/next/actions';

import { SubmitPollVoteSchema } from '../schema/public-poll.schema';
import { submitPublicPollVote } from './public-poll.service';

/** Public vote. Auth is not required; the token is the credential. */
export const submitPollVoteAction = enhanceAction(
  async (input) => {
    const result = await submitPublicPollVote(input);
    return { ok: true as const, ...result };
  },
  { schema: SubmitPollVoteSchema, auth: false },
);
