'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Loader2, Plus, Star, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import { listSystemTemplatesForKindAction } from '~/lib/content-templates/account.actions';
import type {
  SystemContentTemplate,
  UserContentTemplate,
} from '~/lib/content-templates/types';
import {
  deleteUserReplyPresetAction,
  duplicateSystemReplyToUserAction,
  listUserReplyPresetsAction,
  setUserReplyPresetDefaultAction,
  upsertUserReplyPresetAction,
} from '~/lib/content-templates/user.actions';

export function EmailReplyPresetsSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [presets, setPresets] = useState<UserContentTemplate[]>([]);
  const [system, setSystem] = useState<SystemContentTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listUserReplyPresetsAction({}),
      listSystemTemplatesForKindAction({ kind: 'email_reply' }),
    ])
      .then(([userRows, systemRows]) => {
        if (cancelled) return;
        setPresets(userRows);
        setSystem(systemRows);
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : 'Could not load presets',
        );
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setBodyText('');
    setIsDefault(false);
  }

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        resetForm();
        const [userRows, systemRows] = await Promise.all([
          listUserReplyPresetsAction({}),
          listSystemTemplatesForKindAction({ kind: 'email_reply' }),
        ]);
        setPresets(userRows);
        setSystem(systemRows);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Something went wrong',
        );
      }
    });
  }

  return (
    <div className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Reply presets
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Canned replies you can insert when drafting in Email. Duplicate an
          Ozer default or create your own.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Ozer defaults
            </p>
            <ul className="space-y-2">
              {system.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2"
                >
                  <span className="truncate text-sm text-[var(--workspace-shell-text)]">
                    {item.name}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run('Added to your presets', () =>
                        duplicateSystemReplyToUserAction({
                          systemTemplateId: item.id,
                        }),
                      )
                    }
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Your presets
            </p>
            <ul className="space-y-2">
              {presets.length === 0 ? (
                <li className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No personal presets yet.
                </li>
              ) : (
                presets.map((preset) => (
                  <li
                    key={preset.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setEditingId(preset.id);
                        setName(preset.name);
                        setBodyText(preset.bodyText);
                        setIsDefault(preset.isDefault);
                      }}
                    >
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {preset.name}
                        {preset.isDefault ? (
                          <span className="ml-2 text-[10px] text-[var(--ozer-accent-muted)] uppercase">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--workspace-shell-text-muted)]">
                        {preset.bodyText}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {!preset.isDefault ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label="Set default"
                          className="text-[var(--workspace-shell-text-muted)]"
                          onClick={() =>
                            run('Default updated', () =>
                              setUserReplyPresetDefaultAction({
                                id: preset.id,
                              }),
                            )
                          }
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Delete"
                        className="text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                        onClick={() =>
                          run('Preset deleted', () =>
                            deleteUserReplyPresetAction({ id: preset.id }),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {editingId ? 'Edit preset' : 'New preset'}
            </p>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                rows={4}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>Default preset</Label>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !name.trim() || !bodyText.trim()}
                onClick={() =>
                  run(editingId ? 'Preset saved' : 'Preset created', () =>
                    upsertUserReplyPresetAction({
                      id: editingId ?? undefined,
                      name,
                      bodyText,
                      isDefault,
                    }),
                  )
                }
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editingId ? 'Save' : 'Add preset'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
