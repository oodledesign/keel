'use client';

import { useState } from 'react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  IG_TRIGGER_TYPES,
  type IgTriggerType,
} from '~/lib/instagram-autoreply/sequence/step-types';
import {
  workspaceBorder,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  type BuilderTrigger,
  TRIGGER_TYPE_HINTS,
  TRIGGER_TYPE_LABELS,
} from './builder-model';
import { KeywordChips } from './keyword-chips';
import { PostPicker } from './post-picker';

function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={workspaceText}>{props.label}</Label>
      {props.children}
      {props.hint ? (
        <p className={`text-xs ${workspaceTextMuted}`}>{props.hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`text-sm font-medium ${workspaceText}`}>{props.label}</p>
        <p className={`text-xs ${workspaceTextMuted}`}>{props.hint}</p>
      </div>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function SimpleSelect<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={props.value} onValueChange={(v) => props.onChange(v as T)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={workspaceSelectContentClass}>
        {props.options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={workspaceSelectItemClass}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TriggerPanel(props: {
  accountId: string;
  trigger: BuilderTrigger;
  onChange: (patch: Partial<BuilderTrigger>) => void;
  appReviewApproved: boolean;
}) {
  const { trigger, onChange } = props;
  const [pickerOpen, setPickerOpen] = useState(false);

  const isComment = trigger.trigger_type === 'comment_keyword';
  const usesKeywords =
    trigger.trigger_type === 'comment_keyword' ||
    trigger.trigger_type === 'dm_keyword' ||
    trigger.trigger_type === 'story_reply';
  const needsReview =
    trigger.trigger_type === 'ice_breaker' ||
    trigger.trigger_type === 'menu_payload' ||
    trigger.trigger_type === 'story_mention';

  return (
    <section className={`space-y-5 p-5 ${workspacePanelCard}`}>
      <h2 className={`text-base font-semibold ${workspaceText}`}>Trigger</h2>

      <Field label="Name">
        <Input
          value={trigger.name}
          maxLength={120}
          placeholder="e.g. Free guide voice note"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>

      <Field
        label="When"
        hint={
          TRIGGER_TYPE_HINTS[trigger.trigger_type] +
          (needsReview && !props.appReviewApproved
            ? ' Works for your Meta app testers until App Review is approved.'
            : '')
        }
      >
        <SimpleSelect<IgTriggerType>
          value={trigger.trigger_type}
          options={IG_TRIGGER_TYPES.map((type) => ({
            value: type,
            label: TRIGGER_TYPE_LABELS[type],
          }))}
          onChange={(trigger_type) =>
            onChange({
              trigger_type,
              media_scope:
                trigger_type === 'comment_keyword'
                  ? trigger.media_scope
                  : 'any_post',
            })
          }
        />
      </Field>

      {usesKeywords ? (
        <>
          <Field label="Match">
            <SimpleSelect<'contains' | 'exact' | 'any'>
              value={trigger.match_mode}
              options={[
                { value: 'contains', label: 'Contains a keyword' },
                { value: 'exact', label: 'Is exactly a keyword' },
                {
                  value: 'any',
                  label: isComment ? 'Any comment' : 'Any message',
                },
              ]}
              onChange={(match_mode) => onChange({ match_mode })}
            />
          </Field>
          {trigger.match_mode !== 'any' ? (
            <Field
              label="Keywords"
              hint={
                trigger.use_regex
                  ? 'Matched as patterns (advanced).'
                  : 'Not case-sensitive.'
              }
            >
              <KeywordChips
                value={trigger.keywords}
                onChange={(keywords) => onChange({ keywords })}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {isComment ? (
        <Field label="Which posts">
          <SimpleSelect<BuilderTrigger['media_scope']>
            value={trigger.media_scope}
            options={[
              { value: 'any_post', label: 'Any post or reel' },
              { value: 'specific_post', label: 'A specific post' },
              { value: 'reels', label: 'Reels only' },
            ]}
            onChange={(media_scope) => {
              onChange({ media_scope });
              if (media_scope === 'specific_post' && !trigger.media_id) {
                setPickerOpen(true);
              }
            }}
          />
          {trigger.media_scope === 'specific_post' ? (
            <div
              className={`mt-2 flex items-center gap-3 rounded-xl border p-2 ${workspaceBorder}`}
            >
              {trigger.media_preview?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trigger.media_preview.thumbnailUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <p
                className={`line-clamp-2 flex-1 text-xs ${workspaceTextMuted}`}
              >
                {trigger.media_id
                  ? trigger.media_preview?.caption || 'Post selected'
                  : 'No post chosen'}
              </p>
              <button
                type="button"
                className="text-sm text-[var(--ozer-accent)] hover:underline"
                onClick={() => setPickerOpen(true)}
              >
                {trigger.media_id ? 'Change' : 'Choose'}
              </button>
            </div>
          ) : null}
          <PostPicker
            accountId={props.accountId}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            selectedId={trigger.media_id}
            onSelect={(item) =>
              onChange({
                media_id: item.id,
                media_preview: {
                  caption: item.caption,
                  thumbnailUrl: item.thumbnailUrl,
                },
              })
            }
          />
        </Field>
      ) : null}

      <div className={`space-y-4 border-t pt-4 ${workspaceBorder}`}>
        <ToggleRow
          label="Must follow first"
          hint="If they don't follow you, ask them to follow and tap a button to continue."
          checked={trigger.require_follow}
          onChange={(require_follow) => onChange({ require_follow })}
        />
        <ToggleRow
          label="Once per person"
          hint="Never run this automation for the same person twice."
          checked={trigger.once_per_contact}
          onChange={(once_per_contact) => onChange({ once_per_contact })}
        />
        {!trigger.once_per_contact ? (
          <Field
            label="Cooldown (minutes)"
            hint="Ignore repeat triggers from the same person within this time. Leave blank for none."
          >
            <Input
              type="number"
              min={0}
              max={43200}
              value={trigger.cooldown_minutes ?? ''}
              onChange={(e) =>
                onChange({
                  cooldown_minutes: e.target.value
                    ? Math.max(0, Math.min(43200, Number(e.target.value)))
                    : null,
                })
              }
            />
          </Field>
        ) : null}
      </div>

      {isComment ? (
        <div className={`space-y-3 border-t pt-4 ${workspaceBorder}`}>
          <ToggleRow
            label="Public reply to the comment"
            hint="Also reply publicly under their comment."
            checked={trigger.public_reply_enabled}
            onChange={(public_reply_enabled) =>
              onChange({ public_reply_enabled })
            }
          />
          {trigger.public_reply_enabled ? (
            <>
              <SimpleSelect<'static' | 'ai_generated'>
                value={trigger.public_reply_mode}
                options={[
                  { value: 'static', label: 'Fixed text' },
                  {
                    value: 'ai_generated',
                    label: 'Written by AI in your voice',
                  },
                ]}
                onChange={(public_reply_mode) =>
                  onChange({ public_reply_mode })
                }
              />
              {trigger.public_reply_mode === 'static' ? (
                <Textarea
                  value={trigger.public_reply_template}
                  maxLength={2000}
                  placeholder="Sent you a DM 📩"
                  onChange={(e) =>
                    onChange({ public_reply_template: e.target.value })
                  }
                />
              ) : (
                <SimpleSelect<'standard' | 'enhanced'>
                  value={trigger.public_reply_ai_tier}
                  options={[
                    { value: 'standard', label: 'Standard (5 credits)' },
                    { value: 'enhanced', label: 'Enhanced (10 credits)' },
                  ]}
                  onChange={(public_reply_ai_tier) =>
                    onChange({ public_reply_ai_tier })
                  }
                />
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <div className={`space-y-3 border-t pt-4 ${workspaceBorder}`}>
        {isComment ? (
          <ToggleRow
            label="Add to pipeline"
            hint="Create a lead in your pipeline for every matching comment."
            checked={trigger.create_deal_on_match}
            onChange={(create_deal_on_match) =>
              onChange({ create_deal_on_match })
            }
          />
        ) : null}
        <ToggleRow
          label="Active"
          hint="Turn off to pause this automation."
          checked={trigger.is_active}
          onChange={(is_active) => onChange({ is_active })}
        />
      </div>
    </section>
  );
}
