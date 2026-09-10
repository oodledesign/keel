import {
  checkAssistantHealth,
  postAssistantSpeakerEvents,
} from './lib/assistant-client';
import {
  captureToOzer,
  exchangeConnectCode,
  extractTasksToOzer,
  fetchExtensionStatus,
  postOzerSpeakerEvents,
} from './lib/ozer-api';
import type { ExtensionSpeakerEvent, PendingCapture } from './lib/protocol';
import {
  type ExtensionSettings,
  clearToken,
  isKeelToken,
  loadPendingCapture,
  loadSettings,
  savePendingCapture,
  saveSettings,
} from './lib/storage';

type RuntimeMessage =
  | {
      type: 'meet-speaker-events';
      sessionId: string;
      meetUrl?: string;
      meetCode?: string | null;
      events: ExtensionSpeakerEvent[];
    }
  | { type: 'meet-status'; meetCode: string | null; speakerName: string | null }
  | { type: 'get-state' }
  | { type: 'connect-identity' }
  | { type: 'connect-code'; code: string; state: string }
  | { type: 'save-token'; token: string }
  | { type: 'disconnect' }
  | { type: 'save-settings'; patch: Partial<ExtensionSettings> }
  | {
      type: 'capture';
      payload: PendingCapture & { email?: string; phone?: string };
    }
  | { type: 'extract-tasks'; content: string; title?: string }
  | { type: 'page-capture'; capture: PendingCapture };

let lastMeet: {
  meetCode: string | null;
  speakerName: string | null;
  at: number;
} | null = null;
let assistantOnline = false;
let assistantRecording = false;

async function refreshAssistant() {
  const settings = await loadSettings();
  const health = await checkAssistantHealth(settings.assistantOrigin);
  assistantOnline = Boolean(health?.ok);
  assistantRecording = Boolean(health?.recording);
  return health;
}

async function pageSnapshot(): Promise<PendingCapture> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await loadSettings();
  const fallback: PendingCapture = {
    title: tab?.title ?? 'Captured page',
    body: '',
    url: tab?.url ?? '',
    pageTitle: tab?.title ?? '',
    kind: settings.defaultCaptureKind,
  };
  if (!tab?.id || !tab.url || tab.url.startsWith('chrome')) {
    return fallback;
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: location.href,
        selection: window.getSelection()?.toString() ?? '',
      }),
    });
    const value = result?.result as
      | { title?: string; url?: string; selection?: string }
      | undefined;
    const selection = value?.selection?.trim() ?? '';
    return {
      title: selection
        ? (selection
            .split('\n')
            .map((line) => line.trim())
            .find(Boolean) ??
          value?.title ??
          fallback.title)
        : (value?.title ?? fallback.title),
      body: selection,
      url: value?.url ?? fallback.url,
      pageTitle: value?.title ?? fallback.pageTitle,
      kind: settings.defaultCaptureKind,
    };
  } catch {
    return fallback;
  }
}

async function openCaptureUi() {
  const capture = await pageSnapshot();
  await savePendingCapture(capture);
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.windows.create({
      url: chrome.runtime.getURL('capture.html'),
      type: 'popup',
      width: 440,
      height: 620,
    });
  }
}

async function getState() {
  const settings = await loadSettings();
  const pendingCapture = await loadPendingCapture();
  return {
    settings: {
      ...settings,
      token: settings.token ? 'set' : null,
      signedIn: Boolean(settings.token),
    },
    assistant: {
      online: assistantOnline,
      recording: assistantRecording,
    },
    meet: lastMeet,
    pendingCapture,
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ozer-capture',
    title: 'Capture to Ozer',
    contexts: ['selection', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'ozer-capture') return;
  void openCaptureUi();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-to-ozer') {
    void openCaptureUi();
  }
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    void (async () => {
      try {
        if (message.type === 'get-state') {
          await refreshAssistant();
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'meet-status') {
          lastMeet = {
            meetCode: message.meetCode,
            speakerName: message.speakerName,
            at: Date.now(),
          };
          sendResponse({
            ok: true,
            assistantOnline,
            assistantRecording,
          });
          return;
        }

        if (message.type === 'meet-speaker-events') {
          const settings = await loadSettings();
          if (!settings.meetBridgeEnabled) {
            sendResponse({ ok: true, skipped: true });
            return;
          }
          const delivered = await postAssistantSpeakerEvents(
            {
              sessionId: message.sessionId,
              meetUrl: message.meetUrl,
              meetCode: message.meetCode,
              events: message.events,
            },
            settings.assistantOrigin,
          );
          assistantOnline = delivered || assistantOnline;
          if (settings.token) {
            await postOzerSpeakerEvents(
              settings.token,
              {
                session_id: message.sessionId,
                meet_url: message.meetUrl,
                meet_code: message.meetCode,
                account_id: settings.accountId,
                events: message.events,
              },
              settings.ozerOrigin,
            );
          }
          sendResponse({ ok: true, assistantOnline: delivered });
          return;
        }

        if (message.type === 'connect-identity') {
          const settings = await loadSettings();
          const state = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
          const redirectUri = chrome.identity.getRedirectURL();
          const url = `${settings.ozerOrigin.replace(/\/+$/, '')}/connect/chrome-extension?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
          const responseUrl = await chrome.identity.launchWebAuthFlow({
            url,
            interactive: true,
          });
          if (!responseUrl) {
            throw new Error('Connect was cancelled');
          }
          const parsed = new URL(responseUrl);
          const code = parsed.searchParams.get('code');
          const returnedState = parsed.searchParams.get('state');
          if (!code || returnedState !== state) {
            throw new Error('Connect response was incomplete');
          }
          const token = await exchangeConnectCode(
            { code, state },
            settings.ozerOrigin,
          );
          const status = await fetchExtensionStatus(token, settings.ozerOrigin);
          await saveSettings({
            token,
            workspaces: status.workspaces,
            accountId: settings.accountId ?? status.account_id,
          });
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'connect-code') {
          const settings = await loadSettings();
          const token = await exchangeConnectCode(
            { code: message.code, state: message.state },
            settings.ozerOrigin,
          );
          const status = await fetchExtensionStatus(token, settings.ozerOrigin);
          await saveSettings({
            token,
            workspaces: status.workspaces,
            accountId: settings.accountId ?? status.account_id,
          });
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'save-token') {
          if (!isKeelToken(message.token)) {
            throw new Error(
              'Token must be a keel_ API token from Ozer settings',
            );
          }
          const settings = await loadSettings();
          const status = await fetchExtensionStatus(
            message.token,
            settings.ozerOrigin,
          );
          await saveSettings({
            token: message.token.trim(),
            workspaces: status.workspaces,
            accountId: settings.accountId ?? status.account_id,
          });
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'disconnect') {
          await clearToken();
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'save-settings') {
          await saveSettings(message.patch);
          sendResponse({ ok: true, state: await getState() });
          return;
        }

        if (message.type === 'page-capture') {
          await savePendingCapture(message.capture);
          sendResponse({ ok: true });
          return;
        }

        if (message.type === 'capture') {
          const settings = await loadSettings();
          if (!settings.token) {
            throw new Error('Connect the extension to Ozer first');
          }
          const result = await captureToOzer(
            settings.token,
            {
              kind: message.payload.kind,
              account_id: settings.accountId,
              title: message.payload.title,
              body: message.payload.body,
              url: message.payload.url,
              page_title: message.payload.pageTitle,
              email: message.payload.email,
              phone: message.payload.phone,
            },
            settings.ozerOrigin,
          );
          await savePendingCapture(null);
          sendResponse({ ok: true, result });
          return;
        }

        if (message.type === 'extract-tasks') {
          const settings = await loadSettings();
          if (!settings.token || !settings.accountId) {
            throw new Error('Connect a workspace first');
          }
          const result = await extractTasksToOzer(
            settings.token,
            {
              account_id: settings.accountId,
              title: message.title,
              content: message.content,
            },
            settings.ozerOrigin,
          );
          sendResponse({ ok: true, result });
          return;
        }

        sendResponse({ ok: false, error: 'Unknown message' });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Request failed',
        });
      }
    })();
    return true;
  },
);

void refreshAssistant();
setInterval(() => {
  void refreshAssistant();
}, 15_000);
