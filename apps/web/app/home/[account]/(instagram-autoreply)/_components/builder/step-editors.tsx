'use client';

import { useState } from 'react';

import { FileAudio, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
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
  type IgAssetKindClient,
  formatDuration,
} from '~/lib/instagram-autoreply/audio/upload-asset.client';
import {
  IG_BUTTON_TEXT_MAX,
  IG_DELAY_MAX_MINUTES,
  IG_LABEL_MAX,
  IG_TEXT_MAX,
} from '~/lib/instagram-autoreply/sequence/step-types';
import {
  workspaceBorder,
  workspaceInsetSurface,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { IgAssetLibrary } from '../assets/ig-asset-library';
import { IgWaveform } from '../assets/ig-waveform';
import { type BuilderStep, gotoOptions } from './builder-model';
import { KeywordChips } from './keyword-chips';

/** Radix Select cannot use '' as a value. */
const NEXT = '__next';

const DEAL_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'enquiry', label: 'Enquiry' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'call_booked', label: 'Call booked' },
];

type Config = Record<string, unknown>;

type EditorProps = {
  accountId: string;
  step: BuilderStep;
  index: number;
  steps: BuilderStep[];
  onChange: (patch: Partial<BuilderStep>) => void;
};

function str(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={`text-xs ${workspaceText}`}>{props.label}</Label>
      {props.children}
      {props.hint ? (
        <p className={`text-xs ${workspaceTextMuted}`}>{props.hint}</p>
      ) : null}
    </div>
  );
}

function CharCount(props: { value: string; max: number }) {
  return (
    <span className={`text-xs ${workspaceTextMuted}`}>
      {props.value.length}/{props.max}
    </span>
  );
}

function OptionSelect(props: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger className={props.className}>
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

function GotoSelect(props: {
  steps: BuilderStep[];
  index: number;
  value: unknown;
  onChange: (value: string | null) => void;
}) {
  const options = gotoOptions(props.steps, props.index).map((o) => ({
    value: o.value || NEXT,
    label: o.label,
  }));
  return (
    <OptionSelect
      className="w-full sm:w-48"
      value={str(props.value) || NEXT}
      options={options}
      onChange={(v) => props.onChange(v === NEXT ? null : v)}
    />
  );
}

function TemplateHint() {
  return (
    <p className={`text-xs ${workspaceTextMuted}`}>
      Use {'{{name}}'} or {'{{username}}'} to personalise.
    </p>
  );
}

function TextEditor({ step, onChange }: EditorProps) {
  const text = str(step.config.text);
  return (
    <Field label="Message">
      <Textarea
        value={text}
        maxLength={IG_TEXT_MAX}
        rows={3}
        placeholder="Hey {{name}}! Here's what you asked for…"
        onChange={(e) =>
          onChange({ config: { ...step.config, text: e.target.value } })
        }
      />
      <div className="flex justify-between">
        <TemplateHint />
        <CharCount value={text} max={IG_TEXT_MAX} />
      </div>
    </Field>
  );
}

function MediaEditor({ accountId, step, onChange }: EditorProps) {
  const [open, setOpen] = useState(false);
  const kind = step.step_type as IgAssetKindClient;
  const caption = str(step.config.caption);

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 rounded-xl border p-3 ${workspaceBorder} ${workspaceInsetSurface}`}
      >
        <FileAudio className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
        <div className="min-w-0 flex-1">
          {step.asset ? (
            <>
              <p className={`truncate text-sm font-medium ${workspaceText}`}>
                {step.asset.label}
              </p>
              {kind === 'audio' ? (
                <div className="mt-1 flex items-center gap-2">
                  <IgWaveform
                    peaks={step.asset.waveform}
                    className="h-6 flex-1"
                  />
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {formatDuration(step.asset.duration_ms)}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className={`text-sm ${workspaceTextMuted}`}>
              {kind === 'audio'
                ? 'Record or upload a voice note'
                : 'Choose a file'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          {step.asset
            ? 'Change'
            : kind === 'audio'
              ? 'Add voice note'
              : 'Choose'}
        </Button>
      </div>
      <IgAssetLibrary
        accountId={accountId}
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        selectedId={step.asset_id}
        onSelect={(asset) =>
          onChange({
            asset_id: asset.id,
            asset: {
              id: asset.id,
              label: asset.label,
              kind: asset.kind,
              duration_ms: asset.duration_ms,
              waveform: asset.waveform,
            },
          })
        }
      />
      <Field label="Message before it (optional)">
        <Textarea
          value={caption}
          maxLength={IG_TEXT_MAX}
          rows={2}
          placeholder="Here's your voice note 🎧"
          onChange={(e) =>
            onChange({
              config: { ...step.config, caption: e.target.value || undefined },
            })
          }
        />
      </Field>
    </div>
  );
}

function DelayEditor({ step, onChange }: EditorProps) {
  const minutes = Number(step.config.minutes ?? 5);
  const inHours = minutes >= 60 && minutes % 60 === 0;
  const [unit, setUnit] = useState<'minutes' | 'hours'>(
    inHours ? 'hours' : 'minutes',
  );
  const shown = unit === 'hours' ? minutes / 60 : minutes;

  const set = (value: number, nextUnit = unit) => {
    const total = nextUnit === 'hours' ? value * 60 : value;
    onChange({
      config: {
        ...step.config,
        minutes: Math.max(1, Math.min(IG_DELAY_MAX_MINUTES, Math.round(total))),
      },
    });
  };

  return (
    <Field
      label="Wait for"
      hint="Between 1 minute and 23 hours, so the next message lands inside Instagram's 24-hour window."
    >
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          className="w-28"
          value={shown}
          onChange={(e) => set(Number(e.target.value) || 1)}
        />
        <OptionSelect
          className="w-32"
          value={unit}
          options={[
            { value: 'minutes', label: 'minutes' },
            { value: 'hours', label: 'hours' },
          ]}
          onChange={(v) => {
            const nextUnit = v as 'minutes' | 'hours';
            setUnit(nextUnit);
            set(shown, nextUnit);
          }}
        />
      </div>
    </Field>
  );
}

function QuickRepliesEditor(props: EditorProps) {
  const { step, onChange } = props;
  const text = str(step.config.text);
  const options = (step.config.options as Array<Config> | undefined) ?? [];
  const setOptions = (next: Array<Config>) =>
    onChange({ config: { ...step.config, options: next } });

  return (
    <div className="space-y-3">
      <Field label="Message">
        <Textarea
          value={text}
          maxLength={IG_TEXT_MAX}
          rows={2}
          placeholder="Which one would you like?"
          onChange={(e) =>
            onChange({ config: { ...step.config, text: e.target.value } })
          }
        />
      </Field>
      <Field label="Replies" hint="Each reply can jump to a different step.">
        <div className="space-y-2">
          {options.map((option, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={str(option.label)}
                maxLength={IG_LABEL_MAX}
                placeholder={`Reply ${i + 1}`}
                onChange={(e) =>
                  setOptions(
                    options.map((o, j) =>
                      j === i ? { ...o, label: e.target.value } : o,
                    ),
                  )
                }
              />
              <GotoSelect
                steps={props.steps}
                index={props.index}
                value={option.goto}
                onChange={(goto) =>
                  setOptions(
                    options.map((o, j) => (j === i ? { ...o, goto } : o)),
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove reply"
                disabled={options.length <= 1}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={options.length >= 13}
            onClick={() => setOptions([...options, { label: '', goto: null }])}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add reply
          </Button>
        </div>
      </Field>
    </div>
  );
}

function ButtonsEditor(props: EditorProps) {
  const { step, onChange } = props;
  const text = str(step.config.text);
  const buttons = (step.config.buttons as Array<Config> | undefined) ?? [];
  const setButtons = (next: Array<Config>) =>
    onChange({ config: { ...step.config, buttons: next } });

  return (
    <div className="space-y-3">
      <Field label="Message">
        <Textarea
          value={text}
          maxLength={IG_BUTTON_TEXT_MAX}
          rows={2}
          placeholder="Want me to send the voice note?"
          onChange={(e) =>
            onChange({ config: { ...step.config, text: e.target.value } })
          }
        />
        <div className="flex justify-end">
          <CharCount value={text} max={IG_BUTTON_TEXT_MAX} />
        </div>
      </Field>
      <Field
        label="Buttons"
        hint="Up to 3. A tap opens the 24-hour window so you can send media."
      >
        <div className="space-y-2">
          {buttons.map((button, i) => (
            <div
              key={i}
              className={`space-y-2 rounded-lg border p-2 ${workspaceBorder}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={str(button.label)}
                  maxLength={IG_LABEL_MAX}
                  placeholder="Send it 🎧"
                  onChange={(e) =>
                    setButtons(
                      buttons.map((b, j) =>
                        j === i ? { ...b, label: e.target.value } : b,
                      ),
                    )
                  }
                />
                <OptionSelect
                  className="w-full sm:w-36"
                  value={str(button.type, 'postback')}
                  options={[
                    { value: 'postback', label: 'Continue' },
                    { value: 'url', label: 'Open link' },
                  ]}
                  onChange={(type) =>
                    setButtons(
                      buttons.map((b, j) =>
                        j === i
                          ? type === 'url'
                            ? { label: b.label, type, url: str(b.url) }
                            : { label: b.label, type, goto: null }
                          : b,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove button"
                  disabled={buttons.length <= 1}
                  onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {button.type === 'url' ? (
                <Input
                  type="url"
                  value={str(button.url)}
                  placeholder="https://"
                  onChange={(e) =>
                    setButtons(
                      buttons.map((b, j) =>
                        j === i ? { ...b, url: e.target.value } : b,
                      ),
                    )
                  }
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    Then go to
                  </span>
                  <GotoSelect
                    steps={props.steps}
                    index={props.index}
                    value={button.goto}
                    onChange={(goto) =>
                      setButtons(
                        buttons.map((b, j) => (j === i ? { ...b, goto } : b)),
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={buttons.length >= 3}
            onClick={() =>
              setButtons([
                ...buttons,
                { label: '', type: 'postback', goto: null },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add button
          </Button>
        </div>
      </Field>
    </div>
  );
}

function CollectDataEditor({ step, onChange }: EditorProps) {
  const c = step.config;
  const set = (patch: Config) => onChange({ config: { ...c, ...patch } });
  const field = str(c.field, 'email');

  return (
    <div className="space-y-3">
      <Field label="Ask for">
        <OptionSelect
          value={field}
          options={[
            { value: 'email', label: 'Email address' },
            { value: 'phone', label: 'Phone number (UK)' },
            { value: 'name', label: 'Name' },
            { value: 'text', label: 'Free text answer' },
            { value: 'consent', label: 'Marketing consent' },
          ]}
          onChange={(value) => set({ field: value })}
        />
      </Field>
      <Field label="Question">
        <Textarea
          value={str(c.prompt)}
          maxLength={IG_TEXT_MAX}
          rows={2}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </Field>
      <Field
        label="If the answer isn't valid (optional)"
        hint="We ask again up to twice, then carry on."
      >
        <Input
          value={str(c.retry_prompt)}
          maxLength={IG_TEXT_MAX}
          placeholder="Sorry, that doesn't look right. Could you send it again?"
          onChange={(e) => set({ retry_prompt: e.target.value || undefined })}
        />
      </Field>
      {field === 'consent' ? (
        <Field
          label="What they're agreeing to"
          hint="Stored with their answer, the exact question and the time, for UK GDPR records."
        >
          <Input
            value={str(c.consent_purpose)}
            maxLength={200}
            placeholder="Marketing messages about our services"
            onChange={(e) =>
              set({ consent_purpose: e.target.value || undefined })
            }
          />
        </Field>
      ) : null}
      {field === 'text' ? (
        <Field
          label="Save as field"
          hint="Lowercase letters, numbers and _ (e.g. budget)."
        >
          <Input
            value={str(c.custom_field_key)}
            maxLength={40}
            placeholder="budget"
            onChange={(e) =>
              set({
                custom_field_key:
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') ||
                  undefined,
              })
            }
          />
        </Field>
      ) : null}
      {field !== 'consent' ? (
        <div className={`space-y-3 rounded-lg border p-3 ${workspaceBorder}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`text-sm ${workspaceText}`}>Add to clients</span>
            <Switch
              checked={Boolean(c.sync_to_crm)}
              onCheckedChange={(v) => set({ sync_to_crm: v })}
            />
          </div>
          {c.sync_to_crm ? (
            <>
              <p className={`text-xs ${workspaceTextMuted}`}>
                Matches existing clients by email, then phone, before creating a
                new one.
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${workspaceText}`}>
                  Create a pipeline lead
                </span>
                <Switch
                  checked={Boolean(c.create_deal)}
                  onCheckedChange={(v) => set({ create_deal: v })}
                />
              </div>
              {c.create_deal ? (
                <OptionSelect
                  value={str(c.deal_stage, 'lead')}
                  options={DEAL_STAGES}
                  onChange={(value) => set({ deal_stage: value })}
                />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm ${workspaceText}`}>
                  Create a follow-up task
                </span>
                <Switch
                  checked={Boolean(c.create_task)}
                  onCheckedChange={(v) => set({ create_task: v })}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TagEditor({ step, onChange }: EditorProps) {
  const add = (step.config.add as string[] | undefined) ?? [];
  const remove = (step.config.remove as string[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <Field label="Add tags">
        <KeywordChips
          value={add}
          placeholder="e.g. lead, voice-note"
          onChange={(value) =>
            onChange({ config: { ...step.config, add: value } })
          }
        />
      </Field>
      <Field label="Remove tags">
        <KeywordChips
          value={remove}
          placeholder="Tag to remove"
          onChange={(value) =>
            onChange({ config: { ...step.config, remove: value } })
          }
        />
      </Field>
    </div>
  );
}

function ConditionEditor(props: EditorProps) {
  const { step, onChange } = props;
  const c = step.config;
  const set = (patch: Config) => onChange({ config: { ...c, ...patch } });
  const check = str(c.check, 'is_follower');

  return (
    <div className="space-y-3">
      <Field label="If">
        <OptionSelect
          value={check}
          options={[
            { value: 'is_follower', label: 'They follow you' },
            { value: 'has_tag', label: 'They have a tag' },
            { value: 'field_set', label: 'A field is filled in' },
            { value: 'field_equals', label: 'A field equals' },
          ]}
          onChange={(value) => set({ check: value })}
        />
      </Field>
      {check === 'has_tag' ? (
        <Input
          value={str(c.tag)}
          maxLength={40}
          placeholder="Tag"
          onChange={(e) => set({ tag: e.target.value })}
        />
      ) : null}
      {check === 'field_set' || check === 'field_equals' ? (
        <div className="flex gap-2">
          <Input
            value={str(c.field)}
            maxLength={40}
            placeholder="Field (e.g. email)"
            onChange={(e) => set({ field: e.target.value })}
          />
          {check === 'field_equals' ? (
            <Input
              value={str(c.value)}
              maxLength={200}
              placeholder="Value"
              onChange={(e) => set({ value: e.target.value })}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Yes → go to">
          <GotoSelect
            steps={props.steps}
            index={props.index}
            value={c.then_goto}
            onChange={(then_goto) => set({ then_goto })}
          />
        </Field>
        <Field label="No → go to">
          <GotoSelect
            steps={props.steps}
            index={props.index}
            value={c.else_goto}
            onChange={(else_goto) => set({ else_goto })}
          />
        </Field>
      </div>
    </div>
  );
}

function HandoffEditor({ step, onChange }: EditorProps) {
  return (
    <Field
      label="Message before handing over (optional)"
      hint="The automation stops and the chat appears in your Inbox."
    >
      <Textarea
        value={str(step.config.text)}
        maxLength={IG_TEXT_MAX}
        rows={2}
        onChange={(e) =>
          onChange({
            config: { ...step.config, text: e.target.value || undefined },
          })
        }
      />
    </Field>
  );
}

export function StepEditor(props: EditorProps) {
  switch (props.step.step_type) {
    case 'text':
      return <TextEditor {...props} />;
    case 'audio':
    case 'image':
    case 'video':
    case 'pdf':
      return <MediaEditor {...props} />;
    case 'delay':
      return <DelayEditor {...props} />;
    case 'quick_replies':
      return <QuickRepliesEditor {...props} />;
    case 'buttons':
      return <ButtonsEditor {...props} />;
    case 'collect_data':
      return <CollectDataEditor {...props} />;
    case 'tag':
      return <TagEditor {...props} />;
    case 'condition':
      return <ConditionEditor {...props} />;
    case 'handoff':
      return <HandoffEditor {...props} />;
  }
}
