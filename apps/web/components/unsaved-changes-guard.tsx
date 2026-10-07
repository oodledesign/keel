'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

type Props = {
  isDirty: boolean;
  /** Persist the changes. Throw to keep the user on the page. */
  onSave: () => Promise<void>;
  /** Hide the floating "Unsaved changes" pill (dialog + tab-close guard stay). */
  hideIndicator?: boolean;
};

function internalHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
    return null;
  }
  const raw = anchor.getAttribute('href');
  if (!raw || raw.startsWith('#')) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(raw)) return null;

  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    ) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Warns about unsaved edits: floating indicator with a Save button, a
 * browser prompt on refresh/close, and a Save / Discard / Keep editing dialog
 * when clicking any in-app link.
 */
export function UnsavedChangesGuard({ isDirty, onSave, hideIndicator }: Props) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(isDirty);
  const bypassRef = useRef(false);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || bypassRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.closest('[role="dialog"]')) return;
      const href = internalHref(anchor);
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  function leave(href: string) {
    bypassRef.current = true;
    setPendingHref(null);
    router.push(href);
  }

  async function saveAndLeave() {
    if (!pendingHref) return;
    setSaving(true);
    try {
      await onSave();
      leave(pendingHref);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save your changes',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveInPlace() {
    setSaving(true);
    try {
      await onSave();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save your changes',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {isDirty && !hideIndicator ? (
        <div
          className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-500/40 bg-[var(--workspace-shell-panel)] px-4 py-2 text-sm text-[var(--workspace-shell-text)] shadow-lg"
          role="status"
          data-test="unsaved-changes-indicator"
        >
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          Unsaved changes
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={saveInPlace}
            data-test="unsaved-changes-save"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={pendingHref !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingHref(null);
        }}
      >
        <DialogContent data-test="unsaved-changes-dialog">
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>
              You have changes that haven&apos;t been saved. Save them before
              leaving, or discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setPendingHref(null)}
            >
              Keep editing
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => pendingHref && leave(pendingHref)}
                data-test="unsaved-changes-discard"
              >
                Discard changes
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={saveAndLeave}
                data-test="unsaved-changes-save-leave"
              >
                {saving ? 'Saving…' : 'Save and leave'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
