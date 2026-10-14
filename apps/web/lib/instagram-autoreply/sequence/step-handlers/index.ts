import 'server-only';

import type { StepContext, StepOutcome } from '../engine-types';
import type { IgStep } from '../step-types';
import { handleCollectDataStep } from './collect-data';
import { handleConditionStep, handleDelayStep, handleTagStep } from './flow';
import {
  handleButtonsStep,
  handleHandoffStep,
  handleMediaStep,
  handleQuickRepliesStep,
  handleTextStep,
} from './messages';

export async function executeStep(
  ctx: StepContext,
  step: IgStep,
): Promise<StepOutcome> {
  switch (step.step_type) {
    case 'text':
      return handleTextStep(ctx, step.config);
    case 'audio':
    case 'image':
    case 'video':
    case 'pdf':
      return handleMediaStep(ctx, step);
    case 'delay':
      return handleDelayStep(step.config);
    case 'quick_replies':
      return handleQuickRepliesStep(ctx, step.config);
    case 'buttons':
      return handleButtonsStep(ctx, step.config);
    case 'collect_data':
      return handleCollectDataStep(ctx, step.config);
    case 'tag':
      return handleTagStep(ctx, step.config);
    case 'condition':
      return handleConditionStep(ctx, step.config);
    case 'handoff':
      return handleHandoffStep(ctx, step.config);
  }
}
