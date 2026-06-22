'use client';

import { useState } from 'react';

import type { UseFormReturn } from 'react-hook-form';

import { Badge } from '@kit/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type { WorkspaceFocusSettings } from '~/home/[account]/settings/focus/actions';
import useWorkspaceFocus from '~/lib/hooks/use-workspace-focus';

import {
  OOO_TRIGGER_OPTIONS,
  oooTriggerReasonLabel,
  toWorkspaceFocusPreview,
  type FocusFormValues,
} from '../_lib/focus-form';

type OOOSectionProps = {
  form: UseFormReturn<FocusFormValues>;
  accountId: string;
  persisted: WorkspaceFocusSettings | null;
};

export function OOOSection({ form, accountId, persisted }: OOOSectionProps) {
  const values = form.watch();
  const previewSettings = toWorkspaceFocusPreview(values, accountId, persisted);
  const focusState = useWorkspaceFocus(previewSettings);
  const [holidayMessageEnabled, setHolidayMessageEnabled] = useState(
    Boolean(values.ooo_holiday_message?.length),
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const oooEnabled = values.ooo_enabled;
  const triggerReason = oooTriggerReasonLabel(values.ooo_trigger, {
    isOOOActive: focusState.isOOOActive,
    isWithinWorkHours: focusState.isWithinWorkHours,
    isHolidayModeActive: focusState.isHolidayModeActive,
    oooEnabled: values.ooo_enabled,
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-white">
          Out of office replies
        </h2>
        <p className="text-sm text-zinc-400">
          Automatically reply to incoming messages when you&apos;re not
          available.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <FormField
          control={form.control}
          name="ooo_enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700/80 bg-zinc-900/30 p-4">
              <FormLabel className="text-sm font-medium text-white">
                Enable out of office replies
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            oooEnabled ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-6 pt-1">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  When to send
                </p>
                <FormField
                  control={form.control}
                  name="ooo_trigger"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-2"
                        >
                          {OOO_TRIGGER_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className="flex cursor-pointer gap-3 rounded-xl border border-zinc-700/80 bg-zinc-900/20 p-3 transition-colors hover:border-zinc-600"
                            >
                              <RadioGroupItem
                                value={option.value}
                                className="mt-0.5 border-zinc-500"
                              />
                              <span className="space-y-1">
                                <span className="block text-sm font-medium text-white">
                                  {option.label}
                                </span>
                                <span className="block text-sm text-zinc-400">
                                  {option.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ooo_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">
                      Your OOO message
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        maxLength={2000}
                        rows={5}
                        placeholder="Thanks for your message. I'm currently outside my working hours and will get back to you as soon as I can."
                        className="border-zinc-600 bg-zinc-900/40 text-white placeholder:text-zinc-500"
                      />
                    </FormControl>
                    <FormDescription className="text-right text-zinc-500">
                      {field.value.length}/2000
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-xl border border-zinc-700/80 bg-zinc-900/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm text-white">
                    Use a different message when on holiday
                  </Label>
                  <Switch
                    checked={holidayMessageEnabled}
                    onCheckedChange={(checked) => {
                      setHolidayMessageEnabled(checked);
                      if (!checked) {
                        form.setValue('ooo_holiday_message', null, {
                          shouldDirty: true,
                        });
                      }
                    }}
                  />
                </div>

                {holidayMessageEnabled ? (
                  <FormField
                    control={form.control}
                    name="ooo_holiday_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">
                          Holiday message
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            maxLength={2000}
                            rows={4}
                            placeholder="Thanks for getting in touch. I'm currently on holiday and will be back in the office on [date]. I'll reply when I return."
                            className="border-zinc-600 bg-zinc-900/40 text-white placeholder:text-zinc-500"
                            onChange={(event) =>
                              field.onChange(event.target.value || null)
                            }
                          />
                        </FormControl>
                        <FormDescription className="text-zinc-400">
                          If left blank, your standard message will be used
                          instead
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>

              <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-zinc-700/80 bg-zinc-900/20 px-4 py-3 text-sm font-medium text-zinc-200 hover:text-white">
                  More options
                  <span className="text-zinc-500">{moreOpen ? '▴' : '▾'}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="ooo_sender_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">
                          Reply from name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. Dan at Oodle Design"
                            className="border-zinc-600 bg-zinc-900/40 text-white"
                            onChange={(event) =>
                              field.onChange(event.target.value || null)
                            }
                          />
                        </FormControl>
                        <FormDescription className="text-zinc-400">
                          Overrides your display name on OOO replies only
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ooo_cc_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">
                          CC on every reply
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            value={field.value ?? ''}
                            placeholder="e.g. a colleague's address"
                            className="border-zinc-600 bg-zinc-900/40 text-white"
                            onChange={(event) =>
                              field.onChange(event.target.value || null)
                            }
                          />
                        </FormControl>
                        <FormDescription className="text-zinc-400">
                          Useful if someone is covering while you&apos;re away
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ooo_include_return_date"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <FormLabel className="text-sm text-white">
                            Append my return date to the message
                          </FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        <FormDescription className="text-zinc-400">
                          Only applies when a return date is set in holiday mode
                        </FormDescription>
                        {field.value && !values.holiday_mode_until ? (
                          <p className="text-sm text-amber-200">
                            Set a return date in Holiday mode above
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div
                className={cn(
                  'rounded-xl border p-4',
                  focusState.isOOOActive
                    ? 'border-sky-500/30 bg-sky-500/5'
                    : 'border-zinc-700/80 bg-zinc-900/20',
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Preview — message that would send right now
                </p>
                {focusState.isOOOActive ? (
                  <div className="mt-3 space-y-3">
                    <div className="relative rounded-2xl rounded-tl-sm border border-zinc-600 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100">
                      <p className="whitespace-pre-wrap">
                        {focusState.effectiveOOOMessage}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-sky-500/40 text-sky-100"
                    >
                      Trigger: {triggerReason}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    OOO replies are currently off
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
