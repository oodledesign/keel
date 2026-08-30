'use client';

import { useEffect, useRef } from 'react';

import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { isSafeHttpUrl } from '~/lib/campaigns/campaign-document';
import { CAMPAIGN_MERGE_FIELDS } from '~/lib/campaigns/merge-fields';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

export function CampaignTextBlockEditor({
  html,
  disabled,
  onChange,
}: {
  html: string;
  disabled?: boolean;
  onChange: (html: string) => void;
}) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write this text block…',
      }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[96px] px-3 py-2 text-sm leading-relaxed outline-none',
          workspaceText,
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getHTML());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--workspace-shell-border)] px-2 py-1.5">
        <ToolbarButton
          label="B"
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          active={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="Link"
          disabled={disabled}
          onClick={() => {
            const href = window.prompt('Link URL (https://…)', 'https://');
            if (!href?.trim() || !isSafeHttpUrl(href.trim())) return;
            editor
              .chain()
              .focus()
              .insertContent(`<a href="${href}">${href}</a>`)
              .run();
          }}
        />
        <span className={`mx-1 text-[10px] uppercase ${workspaceTextMuted}`}>
          Merge
        </span>
        {CAMPAIGN_MERGE_FIELDS.map((field) => (
          <ToolbarButton
            key={field.token}
            label={field.label}
            disabled={disabled}
            onClick={() =>
              editor.chain().focus().insertContent(field.token).run()
            }
          />
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      className="h-7 px-2 text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
