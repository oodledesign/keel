'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  WORKSPACE_OPTIONS,
  type WorkspaceId,
  isWorkspaceId,
  pathForWorkspaceSwitch,
  workspaceFromPathname,
} from '../lib/workspaces';

const STORAGE_KEY = 'ozer-docs-workspace';

export function WorkspaceSwitcher() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fromPath = workspaceFromPathname(pathname);
  const [selected, setSelected] = useState<WorkspaceId | ''>(fromPath ?? '');

  useEffect(() => {
    if (fromPath) {
      setSelected(fromPath);
      try {
        // Persist when arriving via deep link or in-doc navigation
        window.localStorage.setItem(STORAGE_KEY, fromPath);
      } catch {
        // ignore
      }
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isWorkspaceId(stored)) {
        setSelected(stored);
      }
    } catch {
      // ignore
    }
  }, [fromPath]);

  function onChange(next: string) {
    if (!isWorkspaceId(next)) {
      return;
    }

    setSelected(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }

    const href = pathForWorkspaceSwitch(pathname, next);
    startTransition(() => {
      router.push(href);
      router.refresh();
    });
  }

  return (
    <label className="ozer-workspace-switcher">
      <span className="ozer-workspace-switcher-label">Workspace</span>
      <select
        className="ozer-workspace-switcher-select"
        value={selected}
        disabled={pending}
        aria-label="Documentation workspace type"
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Choose workspace…
        </option>
        {WORKSPACE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id} title={option.description}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
