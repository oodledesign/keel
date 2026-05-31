'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Textarea } from '@kit/ui/textarea';

import type {
  DeepWorkPreference,
  PlannerPreferences,
} from './planner-types';

type Props = {
  preferences: PlannerPreferences;
  onPreferencesChange: (preferences: PlannerPreferences) => void;
};

export function PreferencesSection({
  preferences,
  onPreferencesChange,
}: Props) {
  return (
    <Collapsible>
      <div className="rounded-xl border border-white/8 bg-white/[0.03]">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <SlidersHorizontal className="h-4 w-4 text-[#5eead4]" />
            Preferences
          </span>
          <ChevronDown className="h-4 w-4 text-white/45" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 border-t border-white/8 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="time"
                value={preferences.workingHours.start}
                onChange={(e) =>
                  onPreferencesChange({
                    ...preferences,
                    workingHours: {
                      ...preferences.workingHours,
                      start: e.target.value,
                    },
                  })
                }
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="time"
                value={preferences.workingHours.end}
                onChange={(e) =>
                  onPreferencesChange({
                    ...preferences,
                    workingHours: {
                      ...preferences.workingHours,
                      end: e.target.value,
                    },
                  })
                }
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deep work preference</Label>
            <RadioGroup
              value={preferences.deepWorkPreference}
              onValueChange={(value) =>
                onPreferencesChange({
                  ...preferences,
                  deepWorkPreference: value as DeepWorkPreference,
                })
              }
              className="grid grid-cols-3 gap-2"
            >
              {([
                ['morning', 'Morning'],
                ['afternoon', 'Afternoon'],
                ['none', 'No preference'],
              ] as const).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"
                >
                  <RadioGroupItem value={value} className="border-white/40" />
                  {label}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Context</Label>
            <Textarea
              value={preferences.userContext}
              onChange={(e) =>
                onPreferencesChange({
                  ...preferences,
                  userContext: e.target.value,
                })
              }
              rows={3}
              placeholder="Anything Claude should know? e.g. low energy today, deadline pressure, school run at 3pm"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
