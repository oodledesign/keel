'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ChevronDown,
  GripVertical,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import {
  igStepInputSchema,
  validateIgSequence,
} from '~/lib/instagram-autoreply/sequence/step-types';
import {
  workspaceBorder,
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { saveIgAutomationActionSchema } from '../../_lib/schema/instagram-autoreply.schema';
import { saveIgAutomation } from '../../_lib/server/instagram-sequence-actions';
import {
  ADDABLE_STEP_TYPES,
  type BuilderStep,
  type BuilderTrigger,
  STEP_TYPE_LABELS,
  newStep,
  toSaveSteps,
} from './builder-model';
import { DmPreview } from './dm-preview';
import { SendTestDialog } from './send-test-dialog';
import { StepEditor } from './step-editors';
import { TriggerPanel } from './trigger-panel';

type StepIssue = { index: number | null; message: string };

function SortableStep(props: {
  accountId: string;
  step: BuilderStep;
  index: number;
  steps: BuilderStep[];
  issues: string[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<BuilderStep>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.step.uid });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${workspacePanelCard} ${isDragging ? 'z-10 opacity-80' : ''} ${
        props.issues.length ? 'border-[var(--destructive)]' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          className={`cursor-grab touch-none p-1 ${workspaceTextMuted}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={props.onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className={`text-xs ${workspaceTextMuted}`}>
            {props.index + 1}
          </span>
          <span className={`text-sm font-medium ${workspaceText}`}>
            {STEP_TYPE_LABELS[props.step.step_type]}
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 transition-transform ${props.expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Delete step"
          onClick={props.onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {props.expanded ? (
        <div className={`border-t p-4 ${workspaceBorder}`}>
          <StepEditor
            accountId={props.accountId}
            step={props.step}
            index={props.index}
            steps={props.steps}
            onChange={props.onChange}
          />
        </div>
      ) : null}
      {props.issues.length ? (
        <ul className="space-y-0.5 px-4 pb-3">
          {props.issues.map((issue) => (
            <li key={issue} className="text-xs text-[var(--destructive)]">
              {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AutomationBuilder(props: {
  accountId: string;
  triggerId: string | null;
  initialTrigger: BuilderTrigger;
  initialSteps: BuilderStep[];
  businessUsername: string | null;
  appReviewApproved: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [trigger, setTrigger] = useState(props.initialTrigger);
  const [steps, setSteps] = useState(props.initialSteps);
  const [expanded, setExpanded] = useState<string | null>(
    props.initialSteps[0]?.uid ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const issues = useMemo<StepIssue[]>(() => {
    const parsed: StepIssue[] = [];
    const valid = steps.flatMap((step, index) => {
      const result = igStepInputSchema.safeParse(toSaveSteps([step])[0]);
      if (!result.success) {
        parsed.push({
          index,
          message: result.error.issues[0]?.message ?? 'Check this step',
        });
        return [];
      }
      return [result.data];
    });
    if (parsed.length > 0) return parsed;
    return validateIgSequence(valid, { triggerType: trigger.trigger_type });
  }, [steps, trigger.trigger_type]);

  const updateTrigger = (patch: Partial<BuilderTrigger>) => {
    setTrigger((t) => ({ ...t, ...patch }));
    setDirty(true);
  };

  const updateStep = (uid: string, patch: Partial<BuilderStep>) => {
    setSteps((list) =>
      list.map((s) => (s.uid === uid ? { ...s, ...patch } : s)),
    );
    setDirty(true);
  };

  const addStep = (type: BuilderStep['step_type']) => {
    const step = newStep(type);
    setSteps((list) => [...list, step]);
    setExpanded(step.uid);
    setDirty(true);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSteps((list) => {
      const from = list.findIndex((s) => s.uid === active.id);
      const to = list.findIndex((s) => s.uid === over.id);
      return arrayMove(list, from, to);
    });
    setDirty(true);
  };

  const save = () => {
    setShowIssues(true);
    const payload = {
      accountId: props.accountId,
      triggerId: props.triggerId ?? undefined,
      name: trigger.name,
      trigger_type: trigger.trigger_type,
      keywords: trigger.keywords,
      match_mode: trigger.match_mode,
      use_regex: trigger.use_regex,
      media_scope: trigger.media_scope,
      media_id: trigger.media_id,
      require_follow: trigger.require_follow,
      once_per_contact: trigger.once_per_contact,
      cooldown_minutes: trigger.cooldown_minutes,
      public_reply_enabled: trigger.public_reply_enabled,
      public_reply_mode: trigger.public_reply_mode,
      public_reply_template: trigger.public_reply_template,
      public_reply_ai_tier: trigger.public_reply_ai_tier,
      create_deal_on_match: trigger.create_deal_on_match,
      deal_stage: trigger.deal_stage,
      is_active: trigger.is_active,
      steps: toSaveSteps(steps),
    };

    const check = saveIgAutomationActionSchema.safeParse(payload);
    if (!check.success) {
      toast.error(
        check.error.issues[0]?.message ?? 'Check the highlighted steps',
      );
      return;
    }

    startSaving(async () => {
      try {
        const result = await saveIgAutomation(check.data);
        setDirty(false);
        toast.success('Automation saved');
        if (!props.triggerId) {
          router.replace(`${props.backHref}/${result.triggerId}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  const sequenceIssues = issues.filter((i) => i.index === null);

  return (
    <div className="mx-4 grid gap-6 lg:mx-0 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,22rem)]">
      <TriggerPanel
        accountId={props.accountId}
        trigger={trigger}
        onChange={updateTrigger}
        appReviewApproved={props.appReviewApproved}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className={`text-base font-semibold ${workspaceText}`}>
            Sequence
          </h2>
          <div className="flex items-center gap-2">
            {props.triggerId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={dirty}
                title={
                  dirty ? 'Save first to test the latest version' : undefined
                }
                onClick={() => setTestOpen(true)}
              >
                <Send className="mr-1 h-4 w-4" aria-hidden />
                Send to me
              </Button>
            ) : null}
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={saving}
              onClick={save}
            >
              {saving
                ? 'Saving…'
                : dirty || !props.triggerId
                  ? 'Save'
                  : 'Saved'}
            </button>
          </div>
        </div>

        {showIssues && sequenceIssues.length ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--destructive)] px-3 py-2 text-sm text-[var(--destructive)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{sequenceIssues.map((i) => i.message).join(' ')}</span>
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.uid)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <SortableStep
                  key={step.uid}
                  accountId={props.accountId}
                  step={step}
                  index={index}
                  steps={steps}
                  issues={
                    showIssues
                      ? issues
                          .filter((i) => i.index === index)
                          .map((i) => i.message)
                      : []
                  }
                  expanded={expanded === step.uid}
                  onToggle={() =>
                    setExpanded((current) =>
                      current === step.uid ? null : step.uid,
                    )
                  }
                  onChange={(patch) => updateStep(step.uid, patch)}
                  onRemove={() => {
                    setSteps((list) => list.filter((s) => s.uid !== step.uid));
                    setDirty(true);
                  }}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full">
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Add step
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={`w-56 ${workspaceSelectContentClass}`}
          >
            {ADDABLE_STEP_TYPES.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => addStep(type)}>
                {STEP_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {trigger.trigger_type === 'comment_keyword' ? (
          <p className={`text-xs ${workspaceTextMuted}`}>
            Instagram allows one Private Reply per comment, and it can&apos;t
            contain media. Start with a button such as &ldquo;Send it 🎧&rdquo;;
            once they tap it you can send the voice note.
          </p>
        ) : null}
      </section>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <DmPreview
          trigger={trigger}
          steps={steps}
          businessName={props.businessUsername ?? 'Your business'}
        />
      </aside>

      {props.triggerId ? (
        <SendTestDialog
          accountId={props.accountId}
          triggerId={props.triggerId}
          businessUsername={props.businessUsername}
          open={testOpen}
          onOpenChange={setTestOpen}
        />
      ) : null}
    </div>
  );
}
