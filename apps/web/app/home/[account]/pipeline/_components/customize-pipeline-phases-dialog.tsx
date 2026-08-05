'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Eye, EyeOff, Loader2, RotateCcw, Settings2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  type PipelineStageConfigItem,
  defaultCommercialPipelineStageConfig,
} from '~/lib/commercial/pipeline-stage-config';

import { savePipelineBoardStageSettings } from '../_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  initialStages: PipelineStageConfigItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, only the dialog is rendered (controlled via open/onOpenChange). */
  showTrigger?: boolean;
};

export function CustomizePipelinePhasesDialog({
  accountId,
  accountSlug,
  initialStages,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [stages, setStages] = useState<PipelineStageConfigItem[]>(
    initialStages.length > 0
      ? initialStages
      : defaultCommercialPipelineStageConfig(),
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStages(
      initialStages.length > 0
        ? initialStages
        : defaultCommercialPipelineStageConfig(),
    );
  }, [initialStages]);

  const updateLabel = (key: string, label: string) => {
    setStages((prev) =>
      prev.map((stage) => (stage.key === key ? { ...stage, label } : stage)),
    );
  };

  const toggleHidden = (key: string) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.key === key ? { ...stage, hidden: !stage.hidden } : stage,
      ),
    );
  };

  const resetDefaults = () => {
    setStages(defaultCommercialPipelineStageConfig());
  };

  const save = () => {
    const trimmed = stages.map((stage) => ({
      ...stage,
      label: stage.label.trim() || stage.key,
    }));

    if (trimmed.every((stage) => stage.hidden)) {
      toast.error('Keep at least one phase visible');
      return;
    }

    startTransition(async () => {
      try {
        await savePipelineBoardStageSettings({
          accountId,
          accountSlug,
          stages: trimmed,
        });
        toast.success('Deal phases updated');
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save phases',
        );
      }
    });
  };

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80 hover:bg-white/[0.08] hover:text-[var(--workspace-shell-text)]"
          onClick={() => setOpen(true)}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Customize phases
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Customize deal phases</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Rename or hide phases on the deals board. Defaults match Kato
              interest-schedule stages. Hidden phases still appear if deals are
              already in them.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto py-2">
            {stages.map((stage) => (
              <div
                key={stage.key}
                className="flex items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2"
              >
                <Input
                  value={stage.label}
                  onChange={(event) =>
                    updateLabel(stage.key, event.target.value)
                  }
                  className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                  aria-label={`Label for ${stage.key}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  onClick={() => toggleHidden(stage.key)}
                  aria-label={
                    stage.hidden ? `Show ${stage.label}` : `Hide ${stage.label}`
                  }
                >
                  {stage.hidden ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[var(--workspace-shell-text-muted)]"
              onClick={resetDefaults}
              disabled={pending}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset to Kato defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending}
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                onClick={save}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
