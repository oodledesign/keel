import { type PopupState, fillWorkspaceSelect, renderStatus, send } from './ui';

const signedInEl = document.querySelector('#signed-in') as HTMLElement;
const assistantEl = document.querySelector('#assistant') as HTMLElement;
const meetBridgeEl = document.querySelector('#meet-bridge') as HTMLInputElement;
const workspaceEl = document.querySelector('#workspace') as HTMLSelectElement;
const originEl = document.querySelector('#origin') as HTMLInputElement;
const assistantOriginEl = document.querySelector(
  '#assistant-origin',
) as HTMLInputElement;
const kindEl = document.querySelector('#kind') as HTMLSelectElement;
const tokenEl = document.querySelector('#token') as HTMLInputElement;
const codeEl = document.querySelector('#code') as HTMLInputElement;
const stateEl = document.querySelector('#state') as HTMLInputElement;
const messageEl = document.querySelector('#message') as HTMLElement;

function applyState(state: PopupState) {
  renderStatus(
    signedInEl,
    state.settings.signedIn,
    state.settings.signedIn
      ? 'Signed in to Ozer'
      : 'Not signed in — connect or paste a keel_ token',
  );
  renderStatus(
    assistantEl,
    state.assistant.online,
    state.assistant.online
      ? 'Local Assistant reachable'
      : 'Local Assistant not running',
  );
  meetBridgeEl.checked = state.settings.meetBridgeEnabled;
  originEl.value = state.settings.ozerOrigin;
  assistantOriginEl.value = state.settings.assistantOrigin;
  kindEl.value = state.settings.defaultCaptureKind;
  fillWorkspaceSelect(workspaceEl, state);
}

async function refresh() {
  const result = await send({ type: 'get-state' });
  if (result.state) applyState(result.state);
}

document.querySelector('#connect')?.addEventListener('click', async () => {
  const result = await send({ type: 'connect-identity' });
  if (result.state) applyState(result.state);
  messageEl.textContent = result.ok ? 'Connected.' : (result.error ?? '');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

document.querySelector('#disconnect')?.addEventListener('click', async () => {
  const result = await send({ type: 'disconnect' });
  if (result.state) applyState(result.state);
});

document.querySelector('#save')?.addEventListener('click', async () => {
  const result = await send({
    type: 'save-settings',
    patch: {
      meetBridgeEnabled: meetBridgeEl.checked,
      ozerOrigin: originEl.value.trim(),
      assistantOrigin: assistantOriginEl.value.trim(),
      accountId: workspaceEl.value || null,
      defaultCaptureKind: kindEl.value,
    },
  });
  if (result.state) applyState(result.state);
  messageEl.textContent = result.ok ? 'Options saved.' : (result.error ?? '');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

document.querySelector('#save-token')?.addEventListener('click', async () => {
  const result = await send({ type: 'save-token', token: tokenEl.value });
  if (result.state) applyState(result.state);
  messageEl.textContent = result.ok ? 'Token saved.' : (result.error ?? '');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

document.querySelector('#exchange')?.addEventListener('click', async () => {
  const result = await send({
    type: 'connect-code',
    code: codeEl.value,
    state: stateEl.value,
  });
  if (result.state) applyState(result.state);
  messageEl.textContent = result.ok ? 'Connected.' : (result.error ?? '');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

void refresh();
