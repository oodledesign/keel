import 'server-only';

import { updateContactTags } from '../contacts';
import type { StepContext, StepOutcome } from '../engine-types';
import { getFollowerStatus } from '../follower';
import { type IgStepConfigMap, resolveGoto } from '../step-types';

export function handleDelayStep(
  config: IgStepConfigMap['delay'],
  now: Date = new Date(),
): StepOutcome {
  return {
    kind: 'wait_delay',
    until: new Date(now.getTime() + config.minutes * 60_000),
  };
}

export async function handleTagStep(
  ctx: StepContext,
  config: IgStepConfigMap['tag'],
): Promise<StepOutcome> {
  const contact = await updateContactTags(ctx.admin, ctx.contact, {
    add: config.add,
    remove: config.remove,
  });
  ctx.setContact(contact);
  return { kind: 'advance' };
}

export async function handleConditionStep(
  ctx: StepContext,
  config: IgStepConfigMap['condition'],
): Promise<StepOutcome> {
  let matches = false;
  const fields = ctx.contact.custom_fields ?? {};

  switch (config.check) {
    case 'has_tag':
      matches = Boolean(
        config.tag &&
        ctx.contact.tags.includes(config.tag.trim().toLowerCase()),
      );
      break;
    case 'field_set':
      matches = Boolean(config.field && fields[config.field]?.trim());
      break;
    case 'field_equals':
      matches = Boolean(
        config.field &&
        (fields[config.field] ?? '').trim().toLowerCase() ===
          (config.value ?? '').trim().toLowerCase(),
      );
      break;
    case 'is_follower': {
      const result = await getFollowerStatus(ctx.admin, {
        contact: ctx.contact,
        accessToken: ctx.accessToken,
      });
      ctx.setContact(result.contact);
      matches = result.isFollower === true;
      break;
    }
  }

  const target = matches ? config.then_goto : config.else_goto;
  return {
    kind: 'advance',
    next: resolveGoto(ctx.steps, ctx.position, target),
  };
}
