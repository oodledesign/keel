import {
  type CaptureKind,
  DEFAULT_OZER_ORIGIN,
  type ExtensionWorkspace,
  OZER_ASSISTANT_DEFAULT_ORIGIN,
  type PendingCapture,
} from './protocol';

export type ExtensionSettings = {
  meetBridgeEnabled: boolean;
  ozerOrigin: string;
  assistantOrigin: string;
  accountId: string | null;
  token: string | null;
  workspaces: ExtensionWorkspace[];
  defaultCaptureKind: CaptureKind;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  meetBridgeEnabled: true,
  ozerOrigin: DEFAULT_OZER_ORIGIN,
  assistantOrigin: OZER_ASSISTANT_DEFAULT_ORIGIN,
  accountId: null,
  token: null,
  workspaces: [],
  defaultCaptureKind: 'task',
};

const SETTINGS_KEY = 'ozer.extension.settings';
const PENDING_CAPTURE_KEY = 'ozer.extension.pendingCapture';

function chromeStorage(): chrome.storage.LocalStorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const area = chromeStorage();
  if (!area) return { ...DEFAULT_SETTINGS };
  const result = await area.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  const area = chromeStorage();
  if (area) {
    await area.set({ [SETTINGS_KEY]: next });
  }
  return next;
}

export async function clearToken(): Promise<ExtensionSettings> {
  return saveSettings({ token: null, workspaces: [], accountId: null });
}

export async function loadPendingCapture(): Promise<PendingCapture | null> {
  const area = chromeStorage();
  if (!area) return null;
  const result = await area.get(PENDING_CAPTURE_KEY);
  return (result[PENDING_CAPTURE_KEY] as PendingCapture | undefined) ?? null;
}

export async function savePendingCapture(
  capture: PendingCapture | null,
): Promise<void> {
  const area = chromeStorage();
  if (!area) return;
  if (capture) {
    await area.set({ [PENDING_CAPTURE_KEY]: capture });
    return;
  }
  await area.remove(PENDING_CAPTURE_KEY);
}

export function isKeelToken(value: string): boolean {
  return /^keel_[0-9a-f]{48}$/i.test(value.trim());
}
