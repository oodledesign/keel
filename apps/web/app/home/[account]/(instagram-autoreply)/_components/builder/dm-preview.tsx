'use client';

import {
  Clock,
  FileText,
  ImageIcon,
  Play,
  UserRound,
  Video,
} from 'lucide-react';

import { formatDuration } from '~/lib/instagram-autoreply/audio/upload-asset.client';
import { renderTemplate } from '~/lib/instagram-autoreply/sequence/payload';
import {
  workspaceBorder,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { IgWaveform } from '../assets/ig-waveform';
import type { BuilderStep, BuilderTrigger } from './builder-model';

const SAMPLE = { username: 'alex.smith', name: 'Alex Smith' };

function str(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function render(text: string) {
  return renderTemplate(text, SAMPLE);
}

function Bubble(props: { children: React.ReactNode; tone?: 'brand' | 'user' }) {
  const brand = props.tone !== 'user';
  return (
    <div className={`flex ${brand ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
          brand
            ? `bg-[var(--workspace-control-surface)] ${workspaceText}`
            : 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
        }`}
      >
        {props.children}
      </div>
    </div>
  );
}

function SystemNote(props: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 py-1 text-xs ${workspaceTextMuted}`}
    >
      {props.icon}
      {props.children}
    </div>
  );
}

function StepPreview({ step }: { step: BuilderStep }) {
  const c = step.config;
  switch (step.step_type) {
    case 'text':
      return str(c.text) ? <Bubble>{render(str(c.text))}</Bubble> : null;

    case 'audio':
      return (
        <>
          {str(c.caption) ? <Bubble>{render(str(c.caption))}</Bubble> : null}
          <Bubble>
            <span className="flex w-48 items-center gap-2">
              <Play className="h-4 w-4 shrink-0" aria-hidden />
              <IgWaveform peaks={step.asset?.waveform} className="h-5 flex-1" />
              <span className="text-xs opacity-70">
                {formatDuration(step.asset?.duration_ms ?? null)}
              </span>
            </span>
          </Bubble>
        </>
      );

    case 'image':
    case 'video':
    case 'pdf': {
      const Icon =
        step.step_type === 'image'
          ? ImageIcon
          : step.step_type === 'video'
            ? Video
            : FileText;
      return (
        <>
          {str(c.caption) ? <Bubble>{render(str(c.caption))}</Bubble> : null}
          <Bubble>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" aria-hidden />
              {step.asset?.label ?? 'No file chosen'}
            </span>
          </Bubble>
        </>
      );
    }

    case 'delay': {
      const minutes = Number(c.minutes ?? 0);
      const label =
        minutes >= 60 && minutes % 60 === 0
          ? `${minutes / 60} hour${minutes === 60 ? '' : 's'} later`
          : `${minutes} minute${minutes === 1 ? '' : 's'} later`;
      return (
        <SystemNote icon={<Clock className="h-3 w-3" aria-hidden />}>
          {label}
        </SystemNote>
      );
    }

    case 'quick_replies': {
      const options =
        (c.options as Array<{ label?: string }> | undefined) ?? [];
      return (
        <>
          {str(c.text) ? <Bubble>{render(str(c.text))}</Bubble> : null}
          <div className="flex flex-wrap justify-end gap-1.5">
            {options.map((o, i) => (
              <span
                key={i}
                className="rounded-full border border-[var(--ozer-accent)] px-3 py-1 text-xs text-[var(--ozer-accent)]"
              >
                {o.label || `Reply ${i + 1}`}
              </span>
            ))}
          </div>
        </>
      );
    }

    case 'buttons': {
      const buttons =
        (c.buttons as Array<{ label?: string }> | undefined) ?? [];
      return (
        <div className="flex justify-start">
          <div
            className={`w-[80%] overflow-hidden rounded-2xl border ${workspaceBorder} bg-[var(--workspace-control-surface)]`}
          >
            <p
              className={`px-3 py-2 text-sm whitespace-pre-wrap ${workspaceText}`}
            >
              {render(str(c.text)) || 'Message'}
            </p>
            {buttons.map((b, i) => (
              <p
                key={i}
                className={`border-t px-3 py-2 text-center text-sm font-medium text-[var(--workspace-shell-accent-text)] ${workspaceBorder}`}
              >
                {b.label || `Button ${i + 1}`}
              </p>
            ))}
          </div>
        </div>
      );
    }

    case 'collect_data':
      return str(c.prompt) ? <Bubble>{render(str(c.prompt))}</Bubble> : null;

    case 'tag':
      return null;

    case 'condition':
      return <SystemNote>Branches here</SystemNote>;

    case 'handoff':
      return (
        <>
          {str(c.text) ? <Bubble>{render(str(c.text))}</Bubble> : null}
          <SystemNote icon={<UserRound className="h-3 w-3" aria-hidden />}>
            Handed to your team
          </SystemNote>
        </>
      );
  }
}

export function DmPreview(props: {
  trigger: BuilderTrigger;
  steps: BuilderStep[];
  businessName: string;
}) {
  const { trigger } = props;
  const sampleKeyword = trigger.keywords[0] ?? 'GUIDE';

  return (
    <div className={`overflow-hidden ${workspacePanelCard}`}>
      <div
        className={`flex items-center gap-2 border-b px-4 py-3 ${workspaceBorder}`}
      >
        <div
          className="h-7 w-7 rounded-full bg-[var(--ozer-accent)]"
          aria-hidden
        />
        <div>
          <p className={`text-sm font-semibold ${workspaceText}`}>
            {props.businessName}
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>Preview</p>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-2 overflow-y-auto px-4 py-4">
        {trigger.trigger_type === 'comment_keyword' ? (
          <SystemNote>
            @{SAMPLE.username} commented &ldquo;{sampleKeyword}&rdquo; · first
            reply is a Private Reply
          </SystemNote>
        ) : trigger.trigger_type === 'story_mention' ? (
          <SystemNote>
            @{SAMPLE.username} mentioned you in their story
          </SystemNote>
        ) : trigger.trigger_type === 'story_reply' ? (
          <Bubble tone="user">Replied to your story: 🔥</Bubble>
        ) : trigger.trigger_type === 'ice_breaker' ||
          trigger.trigger_type === 'menu_payload' ? (
          <Bubble tone="user">
            Tapped a{' '}
            {trigger.trigger_type === 'ice_breaker'
              ? 'question'
              : 'menu button'}
          </Bubble>
        ) : (
          <Bubble tone="user">
            {trigger.trigger_type === 'dm_keyword' ? sampleKeyword : 'Hi!'}
          </Bubble>
        )}

        {trigger.require_follow ? (
          <SystemNote>Non-followers are asked to follow first</SystemNote>
        ) : null}

        {props.steps.length === 0 ? (
          <p className={`py-8 text-center text-sm ${workspaceTextMuted}`}>
            Add a step to see the preview.
          </p>
        ) : (
          props.steps.map((step) => <StepPreview key={step.uid} step={step} />)
        )}
      </div>
    </div>
  );
}
