import { type CaptureKind, DEFAULT_OZER_ORIGIN } from './lib/protocol';
import { type PopupState, renderStatus, send } from './ui';

const signedInEl = document.querySelector('#signed-in') as HTMLElement;
const assistantEl = document.querySelector('#assistant') as HTMLElement;
const meetEl = document.querySelector('#meet') as HTMLElement;
const meetLinkEl = document.querySelector('#meet-link') as HTMLInputElement;
const kindEl = document.querySelector('#kind') as HTMLSelectElement;
const titleEl = document.querySelector('#title') as HTMLInputElement;
const bodyEl = document.querySelector('#body') as HTMLTextAreaElement;
const emailEl = document.querySelector('#email') as HTMLInputElement;
const messageEl = document.querySelector('#message') as HTMLElement;

let state: PopupState | null = null;

function applyState(next: PopupState) {
  state = next;
  renderStatus(
    signedInEl,
    next.settings.signedIn,
    next.settings.signedIn
      ? 'Signed in to Ozer'
      : 'Not signed in — connect a workspace',
  );
  renderStatus(
    assistantEl,
    next.assistant.online,
    next.assistant.recording
      ? 'Ozer Assistant is recording'
      : next.assistant.online
        ? 'Assistant is running (not recording)'
        : 'Assistant is not running — stamps save to Ozer only',
  );
  const meetFresh = next.meet && Date.now() - next.meet.at < 15_000;
  renderStatus(
    meetEl,
    Boolean(meetFresh && next.meet?.speakerName),
    meetFresh
      ? next.meet?.speakerName
        ? `Meet speaker: ${next.meet.speakerName}`
        : 'On Meet — speaker name unavailable'
      : 'Not on a live Meet tab',
  );
  meetLinkEl.value = next.meet?.meetCode
    ? `https://meet.google.com/${next.meet.meetCode}`
    : '';
  if (next.pendingCapture) {
    kindEl.value = next.pendingCapture.kind;
    titleEl.value = next.pendingCapture.title;
    bodyEl.value = next.pendingCapture.body;
  }
}

async function refresh() {
  const wrapped = await send({ type: 'get-state' });
  if (wrapped.state) applyState(wrapped.state);
  if (!wrapped.ok && wrapped.error) {
    messageEl.textContent = wrapped.error;
    messageEl.className = 'error';
  }
}

document.querySelector('#connect')?.addEventListener('click', async () => {
  messageEl.textContent = 'Connecting…';
  const result = await send({ type: 'connect-identity' });
  if (result.state) applyState(result.state);
  messageEl.textContent = result.ok
    ? 'Connected.'
    : (result.error ?? 'Could not connect');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

document.querySelector('#disconnect')?.addEventListener('click', async () => {
  const result = await send({ type: 'disconnect' });
  if (result.state) applyState(result.state);
});

document.querySelector('#copy-link')?.addEventListener('click', async () => {
  if (!meetLinkEl.value) return;
  await navigator.clipboard.writeText(meetLinkEl.value);
  messageEl.textContent = 'Meeting link copied.';
  messageEl.className = 'ok-text';
});

document.querySelector('#open-ozer')?.addEventListener('click', () => {
  const origin = state?.settings.ozerOrigin ?? DEFAULT_OZER_ORIGIN;
  void chrome.tabs.create({ url: `${origin.replace(/\/+$/, '')}/app` });
});

document.querySelector('#save')?.addEventListener('click', async () => {
  const result = await send({
    type: 'capture',
    payload: {
      kind: kindEl.value as CaptureKind,
      title: titleEl.value,
      body: bodyEl.value,
      url: state?.pendingCapture?.url ?? '',
      pageTitle: state?.pendingCapture?.pageTitle ?? '',
      email: emailEl.value || undefined,
    },
  });
  messageEl.textContent = result.ok
    ? `Saved ${kindEl.value}.`
    : (result.error ?? 'Save failed');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

document.querySelector('#extract')?.addEventListener('click', async () => {
  const content = bodyEl.value.trim();
  if (content.length < 20) {
    messageEl.textContent =
      'Paste a transcript or summary of at least 20 characters.';
    messageEl.className = 'error';
    return;
  }
  const result = await send({
    type: 'extract-tasks',
    content,
    title: titleEl.value,
  });
  messageEl.textContent = result.ok
    ? 'Sent to Ozer extract. Review tasks in the workspace.'
    : (result.error ?? 'Extract failed');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

void refresh();
