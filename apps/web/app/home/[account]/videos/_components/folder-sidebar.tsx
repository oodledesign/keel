'use client';

import { useState } from 'react';

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { VideoFolderRow } from '~/lib/videos/types';

type FolderTreeNode = VideoFolderRow & { children: FolderTreeNode[] };

function buildFolderTree(folders: VideoFolderRow[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    byId.set(folder.id, { ...folder, children: [] });
  }

  const roots: FolderTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_folder_id && byId.has(node.parent_folder_id)) {
      byId.get(node.parent_folder_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function FolderTreeItem(props: {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(props.node.children.length > 0);
  const active = props.selectedFolderId === props.node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => props.onSelect(props.node.id)}
        className={cn(
          'flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition',
          active
            ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
            : 'text-muted-foreground hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
        )}
        style={{ paddingLeft: `${8 + props.depth * 12}px` }}
      >
        {props.node.children.length > 0 ? (
          <span
            className="inline-flex"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="inline-block w-3.5" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{props.node.name}</span>
      </button>
      {open
        ? props.node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={props.depth + 1}
              selectedFolderId={props.selectedFolderId}
              onSelect={props.onSelect}
            />
          ))
        : null}
    </div>
  );
}

export function FolderSidebar(props: {
  folders: VideoFolderRow[];
  selectedFolderId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
}) {
  const tree = buildFolderTree(props.folders);

  if (props.collapsed) {
    return (
      <div className="flex shrink-0 flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={props.onToggleCollapsed}
          aria-label="Show folders"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={props.onCreateFolder}
          aria-label="New folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-56 shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Folders
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={props.onCreateFolder}
            aria-label="New folder"
            title="New folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={props.onToggleCollapsed}
            aria-label="Hide folders"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => props.onSelectFolder(null)}
        className={cn(
          'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
          props.selectedFolderId === null
            ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
            : 'text-muted-foreground hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
        )}
      >
        <Folder className="h-3.5 w-3.5" />
        All videos
      </button>

      {tree.length === 0 ? (
        <button
          type="button"
          onClick={props.onCreateFolder}
          className="text-muted-foreground mt-2 w-full rounded-md border border-dashed border-[color:var(--workspace-shell-border)] px-2 py-3 text-left text-xs transition hover:border-[var(--ozer-accent)]/40 hover:text-[var(--workspace-shell-text)]"
        >
          <span className="inline-flex items-center gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" />
            Create your first folder
          </span>
        </button>
      ) : (
        tree.map((node) => (
          <FolderTreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedFolderId={props.selectedFolderId}
            onSelect={props.onSelectFolder}
          />
        ))
      )}
    </aside>
  );
}
