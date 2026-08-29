'use client';

import { useEffect, useRef } from 'react';

import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { CAMPAIGN_MERGE_FIELDS } from '~/lib/campaigns/merge-fields';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

export function CampaignBodyEditor({
  initialHtml,
  onChange,
  disabled,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  disabled?: boolean;
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
        heading: { levels: [1, 2] },
        codeBlock: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write the email your contacts will receive…',
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[280px] px-4 py-3 text-sm leading-relaxed outline-none',
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
      <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--workspace-shell-border)] px-2 py-2">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="H2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="List"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <span className={`mx-2 text-xs ${workspaceTextMuted}`}>Merge</span>
        {CAMPAIGN_MERGE_FIELDS.map((field) => (
          <ToolbarButton
            key={field.token}
            label={field.label}
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
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      className="h-7 px-2 text-xs"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
