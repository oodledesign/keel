'use client';

import { useState, useTransition } from 'react';

import { Info, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  IG_MAX_ICE_BREAKERS,
  IG_MAX_MENU_ITEMS,
  type IgMenuItemConfig,
  type IgMessengerProfile,
  igMessengerProfileSchema,
} from '~/lib/instagram-autoreply/messenger-profile';
import {
  workspaceBtnPrimaryMd,
  workspaceInfoBadge,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { saveIgMessengerProfile } from '../_lib/server/instagram-messenger-profile-actions';

type EntryTrigger = {
  id: string;
  name: string;
  trigger_type: string;
};

function AutomationSelect(props: {
  value: string;
  options: EntryTrigger[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={props.value || undefined} onValueChange={props.onChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent className={workspaceSelectContentClass}>
        {props.options.map((trigger) => (
          <SelectItem
            key={trigger.id}
            value={trigger.id}
            className={workspaceSelectItemClass}
          >
            {trigger.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function InstagramMessengerProfilePanel(props: {
  accountId: string;
  initial: IgMessengerProfile;
  triggers: EntryTrigger[];
  appReviewApproved: boolean;
}) {
  const [iceBreakers, setIceBreakers] = useState(props.initial.ice_breakers);
  const [menu, setMenu] = useState<IgMenuItemConfig[]>(
    props.initial.persistent_menu,
  );
  const [pending, startTransition] = useTransition();

  const iceBreakerTriggers = props.triggers.filter(
    (t) => t.trigger_type === 'ice_breaker',
  );
  const menuTriggers = props.triggers.filter(
    (t) => t.trigger_type === 'menu_payload',
  );

  const save = () => {
    const parsed = igMessengerProfileSchema.safeParse({
      ice_breakers: iceBreakers,
      persistent_menu: menu,
    });
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? 'Check the highlighted fields',
      );
      return;
    }
    startTransition(async () => {
      try {
        await saveIgMessengerProfile({
          accountId: props.accountId,
          profile: parsed.data,
        });
        toast.success('Saved and sent to Instagram');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update Instagram',
        );
      }
    });
  };

  return (
    <section className={`mx-4 space-y-6 p-6 lg:mx-0 ${workspacePanelCard}`}>
      <div className="space-y-1">
        <h2 className={`text-base font-semibold ${workspaceText}`}>
          Ice Breakers and menu
        </h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Ice Breakers are the questions people can tap when they first open a
          chat with you. The menu stays available in every conversation. Each
          one starts an automation.
        </p>
      </div>

      {!props.appReviewApproved ? (
        <div
          className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${workspaceInfoBadge}`}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Ice Breakers, the menu and story mentions currently work for your
            Meta app&apos;s testers only. They&apos;ll work for everyone once
            Meta approves App Review.
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-medium ${workspaceText}`}>
            Ice Breakers ({iceBreakers.length}/{IG_MAX_ICE_BREAKERS})
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={iceBreakers.length >= IG_MAX_ICE_BREAKERS}
            onClick={() =>
              setIceBreakers((list) => [
                ...list,
                { question: '', trigger_id: '' },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add question
          </Button>
        </div>

        {iceBreakerTriggers.length === 0 ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Create an automation with the &quot;Ice Breaker&quot; trigger first.
          </p>
        ) : null}

        {iceBreakers.map((breaker, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={breaker.question}
              maxLength={80}
              placeholder="e.g. How much does it cost?"
              onChange={(e) =>
                setIceBreakers((list) =>
                  list.map((b, i) =>
                    i === index ? { ...b, question: e.target.value } : b,
                  ),
                )
              }
            />
            <AutomationSelect
              value={breaker.trigger_id}
              options={iceBreakerTriggers}
              placeholder="Choose automation"
              onChange={(value) =>
                setIceBreakers((list) =>
                  list.map((b, i) =>
                    i === index ? { ...b, trigger_id: value } : b,
                  ),
                )
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove question"
              onClick={() =>
                setIceBreakers((list) => list.filter((_, i) => i !== index))
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-medium ${workspaceText}`}>
            Menu ({menu.length}/{IG_MAX_MENU_ITEMS})
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={menu.length >= IG_MAX_MENU_ITEMS}
              onClick={() =>
                setMenu((list) => [
                  ...list,
                  { type: 'postback', title: '', trigger_id: '' },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Automation
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={menu.length >= IG_MAX_MENU_ITEMS}
              onClick={() =>
                setMenu((list) => [
                  ...list,
                  { type: 'web_url', title: '', url: '' },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Link
            </Button>
          </div>
        </div>

        {menu.map((item, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={item.title}
              maxLength={30}
              placeholder="Button label"
              onChange={(e) =>
                setMenu((list) =>
                  list.map((m, i) =>
                    i === index ? { ...m, title: e.target.value } : m,
                  ),
                )
              }
            />
            {item.type === 'postback' ? (
              <AutomationSelect
                value={item.trigger_id}
                options={menuTriggers}
                placeholder="Choose automation"
                onChange={(value) =>
                  setMenu((list) =>
                    list.map((m, i) =>
                      i === index && m.type === 'postback'
                        ? { ...m, trigger_id: value }
                        : m,
                    ),
                  )
                }
              />
            ) : (
              <Input
                value={item.url}
                type="url"
                placeholder="https://"
                onChange={(e) =>
                  setMenu((list) =>
                    list.map((m, i) =>
                      i === index && m.type === 'web_url'
                        ? { ...m, url: e.target.value }
                        : m,
                    ),
                  )
                }
              />
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove menu item"
              onClick={() =>
                setMenu((list) => list.filter((_, i) => i !== index))
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${workspaceTextMuted}`}>
          {props.initial.synced_at
            ? `Last sent to Instagram ${new Date(props.initial.synced_at).toLocaleString('en-GB')}`
            : 'Not sent to Instagram yet'}
        </p>
        <button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={pending}
          onClick={save}
        >
          {pending ? 'Saving…' : 'Save to Instagram'}
        </button>
      </div>
    </section>
  );
}
