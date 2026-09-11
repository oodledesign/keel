export type PopupState = {
  settings: {
    meetBridgeEnabled: boolean;
    ozerOrigin: string;
    assistantOrigin: string;
    accountId: string | null;
    signedIn: boolean;
    workspaces: Array<{ id: string; slug: string; name: string }>;
    defaultCaptureKind: 'task' | 'note' | 'contact';
  };
  assistant: { online: boolean; recording: boolean };
  meet: {
    meetCode: string | null;
    speakerName: string | null;
    at: number;
  } | null;
  pendingCapture: {
    title: string;
    body: string;
    url: string;
    pageTitle: string;
    kind: 'task' | 'note' | 'contact';
  } | null;
};

export function send<T = unknown>(
  message: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; state?: PopupState; result?: T }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(
        (response ?? {
          ok: false,
          error: chrome.runtime.lastError?.message ?? 'No response',
        }) as { ok: boolean; error?: string; state?: PopupState; result?: T },
      );
    });
  });
}

export function renderStatus(el: HTMLElement, ok: boolean, label: string) {
  el.innerHTML = `<span class="dot ${ok ? 'ok' : 'bad'}"></span><span>${label}</span>`;
}

export function fillWorkspaceSelect(
  select: HTMLSelectElement,
  state: PopupState,
) {
  select.innerHTML = '';
  for (const workspace of state.settings.workspaces) {
    const option = document.createElement('option');
    option.value = workspace.id;
    option.textContent = workspace.name;
    if (workspace.id === state.settings.accountId) option.selected = true;
    select.appendChild(option);
  }
}
