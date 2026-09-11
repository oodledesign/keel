/**
 * Future: Dynamics → Ozer “do not email” inbound pause.
 *
 * MVP is Ozer → Dynamics only. Ozer `workspace_mailing_preferences`
 * stays the emailable source of truth. When a Contact’s `donotemail`
 * (or configured consent field) flips in Dataverse, we will enqueue a
 * job that sets the matching Ozer preference to `unsubscribed` /
 * `suppressed` — never the reverse overwrite of a public-form opt-in
 * without an audit trail.
 */
export function describeFutureDynamicsInboundPause(): {
  status: 'not_implemented';
  summary: string;
} {
  return {
    status: 'not_implemented',
    summary:
      'Inbound Dynamics do-not-email will pause the Ozer mailing preference in a later PR. Do not treat Dataverse as consent source of truth.',
  };
}

export async function applyDynamicsDoNotEmailToOzer(_input: {
  accountId: string;
  email: string;
  donotemail: boolean;
}): Promise<never> {
  throw new Error(describeFutureDynamicsInboundPause().summary);
}
