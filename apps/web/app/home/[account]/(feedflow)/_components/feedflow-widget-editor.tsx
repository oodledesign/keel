'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { copyTextToClipboard } from '~/lib/clipboard';
import {
  type FeedflowEmbedPreviewSettings,
  buildIframeEmbedSnippet,
  buildScriptEmbedSnippet,
  feedflowEmbedPreviewPath,
  feedflowFeedJsonUrl,
} from '~/lib/feedflow/embed';
import {
  workspaceBorder,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { FeedflowWidgetRow } from '../../_lib/server/feedflow-account-data';
import { updateFeedflowWidget } from '../_lib/server/feedflow-module-actions';

const POST_COUNTS = [3, 4, 5, 6, 9, 12] as const;

function settingsFromWidget(
  widget: FeedflowWidgetRow,
): FeedflowEmbedPreviewSettings {
  const reveal = widget.reveal_animation;
  return {
    tileRatio: widget.tile_ratio === 'square' ? 'square' : 'portrait',
    showLikes: widget.show_likes !== false,
    playVideos: widget.play_videos !== false,
    revealAnimation:
      reveal === 'fade' ||
      reveal === 'rise' ||
      reveal === 'cascade' ||
      reveal === 'scale'
        ? reveal
        : 'none',
    layout: widget.layout === 'slider' ? 'slider' : 'grid',
    postCount: POST_COUNTS.includes(
      widget.post_count as (typeof POST_COUNTS)[number],
    )
      ? (widget.post_count as number)
      : 9,
  };
}

export function FeedflowWidgetEditor(props: {
  accountId: string;
  origin: string;
  widget: FeedflowWidgetRow;
}) {
  const router = useRouter();
  const [committed, setCommitted] = useState(() =>
    settingsFromWidget(props.widget),
  );
  const [draft, setDraft] = useState<FeedflowEmbedPreviewSettings>(committed);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<'iframe' | 'script' | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(committed);
  const snippets = useMemo(
    () => ({
      iframe: buildIframeEmbedSnippet(props.origin, props.widget.embed_key),
      script: buildScriptEmbedSnippet(props.origin, props.widget.embed_key),
      json: feedflowFeedJsonUrl(props.origin, props.widget.embed_key),
    }),
    [props.origin, props.widget.embed_key],
  );
  const previewSrc = feedflowEmbedPreviewPath(props.widget.embed_key, draft);

  const patch = (next: Partial<FeedflowEmbedPreviewSettings>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const copy = async (kind: 'iframe' | 'script') => {
    try {
      await copyTextToClipboard(snippets[kind]);
      setCopied(kind);
      toast.success('Embed snippet copied');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy snippet');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateFeedflowWidget({
        accountId: props.accountId,
        widgetId: props.widget.id,
        ...draft,
      });
      setCommitted(draft);
      toast.success('Widget saved');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select
              value={draft.layout}
              onValueChange={(value) =>
                patch({ layout: value === 'slider' ? 'slider' : 'grid' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="slider">Slider</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Posts</Label>
            <Select
              value={String(draft.postCount)}
              onValueChange={(value) => patch({ postCount: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_COUNTS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tile shape</Label>
            <Select
              value={draft.tileRatio}
              onValueChange={(value) =>
                patch({ tileRatio: value === 'square' ? 'square' : 'portrait' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait (4:5)</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reveal</Label>
            <Select
              value={draft.revealAnimation}
              onValueChange={(value) =>
                patch({
                  revealAnimation:
                    value === 'fade' ||
                    value === 'rise' ||
                    value === 'cascade' ||
                    value === 'scale'
                      ? value
                      : 'none',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade in</SelectItem>
                <SelectItem value="rise">Rise</SelectItem>
                <SelectItem value="cascade">Cascade</SelectItem>
                <SelectItem value="scale">Scale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <span className="text-sm">Likes and comments</span>
            <Switch
              checked={draft.showLikes}
              onCheckedChange={(checked) => patch({ showLikes: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <span className="text-sm">Play video on hover</span>
            <Switch
              checked={draft.playVideos}
              onCheckedChange={(checked) => patch({ playVideos: checked })}
            />
          </label>
          <p className={`text-xs ${workspaceTextMuted}`}>
            A slider shows five posts at a time on a wide screen, with buttons
            to move left and right. The post count is how many posts are
            included.
          </p>
          <Button type="button" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>

        <div className="space-y-2 lg:sticky lg:top-6">
          <Label>Preview</Label>
          <iframe
            title={`${props.widget.name} preview`}
            src={previewSrc}
            className={`h-[36rem] w-full rounded-md border bg-white ${workspaceBorder}`}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${workspaceTextMuted}`}>
            The snippet stays the same when you change settings. Save, and that
            same code renders the layout you saved.
          </p>
          <a
            href={snippets.json}
            className="text-primary text-sm underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            JSON
          </a>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SnippetBlock
            label="iframe snippet"
            code={snippets.iframe}
            copied={copied === 'iframe'}
            onCopy={() => copy('iframe')}
          />
          <SnippetBlock
            label="script snippet"
            code={snippets.script}
            copied={copied === 'script'}
            onCopy={() => copy('script')}
          />
        </div>
      </div>
    </div>
  );
}

function SnippetBlock(props: {
  label: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{props.label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={props.onCopy}
        >
          {props.copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre
        className={`overflow-x-auto rounded-md border bg-[var(--workspace-control-surface)] p-3 text-xs ${workspaceBorder} ${workspaceText}`}
      >
        <code>{props.code}</code>
      </pre>
    </div>
  );
}
