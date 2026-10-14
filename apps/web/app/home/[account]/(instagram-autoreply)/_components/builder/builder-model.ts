import type { IgAssetListItem } from '~/lib/instagram-autoreply/audio/upload-asset.client';
import {
  IG_GOTO_END,
  type IgStepType,
  type IgTriggerType,
} from '~/lib/instagram-autoreply/sequence/step-types';

export type BuilderAsset = Pick<
  IgAssetListItem,
  'id' | 'label' | 'kind' | 'duration_ms' | 'waveform'
>;

/** A step while editing: free-form config, validated on save. */
export type BuilderStep = {
  uid: string;
  step_type: IgStepType;
  config: Record<string, unknown>;
  asset_id: string | null;
  asset: BuilderAsset | null;
};

export type BuilderTrigger = {
  name: string;
  trigger_type: IgTriggerType;
  keywords: string[];
  match_mode: 'contains' | 'exact' | 'any';
  use_regex: boolean;
  media_scope: 'any_post' | 'specific_post' | 'reels' | 'stories';
  media_id: string | null;
  media_preview: { caption: string | null; thumbnailUrl: string | null } | null;
  require_follow: boolean;
  once_per_contact: boolean;
  cooldown_minutes: number | null;
  public_reply_enabled: boolean;
  public_reply_mode: 'static' | 'ai_generated';
  public_reply_template: string;
  public_reply_ai_tier: 'standard' | 'enhanced';
  create_deal_on_match: boolean;
  deal_stage: string;
  is_active: boolean;
};

export const TRIGGER_TYPE_LABELS: Record<IgTriggerType, string> = {
  comment_keyword: 'Comment on a post',
  dm_keyword: 'DM keyword',
  first_message: 'First message (welcome)',
  story_reply: 'Story reply',
  story_mention: 'Story mention',
  ice_breaker: 'Ice Breaker',
  menu_payload: 'Menu button',
};

export const TRIGGER_TYPE_HINTS: Record<IgTriggerType, string> = {
  comment_keyword:
    'Fires when someone comments a keyword. The first message goes out as a Private Reply.',
  dm_keyword: 'Fires when someone sends you a DM containing a keyword.',
  first_message: 'Welcomes people the first time they message you.',
  story_reply: 'Fires when someone replies to one of your stories.',
  story_mention: 'Fires when someone mentions you in their story.',
  ice_breaker:
    'Starts when someone taps an Ice Breaker question. Link it under Instagram → Ice Breakers and menu.',
  menu_payload:
    'Starts from a persistent menu button. Link it under Instagram → Ice Breakers and menu.',
};

export const STEP_TYPE_LABELS: Record<IgStepType, string> = {
  text: 'Text',
  audio: 'Voice note',
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  delay: 'Wait',
  quick_replies: 'Quick replies',
  buttons: 'Buttons',
  collect_data: 'Collect details',
  tag: 'Tag',
  condition: 'Condition',
  handoff: 'Hand to a person',
};

export const ADDABLE_STEP_TYPES: IgStepType[] = [
  'text',
  'audio',
  'buttons',
  'quick_replies',
  'image',
  'video',
  'pdf',
  'delay',
  'collect_data',
  'tag',
  'condition',
  'handoff',
];

let uidCounter = 0;
export function newUid() {
  uidCounter += 1;
  return `s${Date.now().toString(36)}${uidCounter}`;
}

export function defaultStepConfig(type: IgStepType): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { text: '' };
    case 'audio':
    case 'image':
    case 'video':
    case 'pdf':
      return {};
    case 'delay':
      return { minutes: 5 };
    case 'quick_replies':
      return { text: '', options: [{ label: '', goto: null }] };
    case 'buttons':
      return {
        text: '',
        buttons: [{ label: 'Send it', type: 'postback', goto: null }],
      };
    case 'collect_data':
      return {
        prompt: "What's the best email to send it to?",
        field: 'email',
        max_retries: 2,
        sync_to_crm: false,
        create_deal: false,
        create_task: false,
      };
    case 'tag':
      return { add: [], remove: [] };
    case 'condition':
      return { check: 'is_follower', then_goto: null, else_goto: null };
    case 'handoff':
      return { text: 'Thanks! Someone from the team will reply shortly.' };
  }
}

/** Every step carries a stable key so branches survive reordering. */
export function newStep(type: IgStepType): BuilderStep {
  const uid = newUid();
  return {
    uid,
    step_type: type,
    config: { ...defaultStepConfig(type), key: uid },
    asset_id: null,
    asset: null,
  };
}

export function fromStoredStep(
  stored: {
    step_type: IgStepType;
    config: Record<string, unknown>;
    asset_id: string | null;
  },
  asset: BuilderAsset | null,
): BuilderStep {
  const uid = newUid();
  const key =
    typeof stored.config.key === 'string' && stored.config.key
      ? stored.config.key
      : uid;
  return {
    uid,
    step_type: stored.step_type,
    config: { ...stored.config, key },
    asset_id: stored.asset_id,
    asset,
  };
}

export function stepKey(step: BuilderStep): string {
  return String(step.config.key ?? step.uid);
}

export function gotoOptions(steps: BuilderStep[], currentIndex: number) {
  return [
    { value: '', label: 'Next step' },
    ...steps
      .map((step, index) => ({ step, index }))
      .filter(({ index }) => index !== currentIndex)
      .map(({ step, index }) => ({
        value: stepKey(step),
        label: `Step ${index + 1}: ${STEP_TYPE_LABELS[step.step_type]}`,
      })),
    { value: IG_GOTO_END, label: 'End the sequence' },
  ];
}

export function toSaveSteps(steps: BuilderStep[]) {
  return steps.map((step) => ({
    step_type: step.step_type,
    config: step.config,
    asset_id: step.asset_id,
  }));
}
