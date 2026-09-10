import type { CaptureKind } from './lib/protocol';
import { renderStatus, send } from './ui';

const signedInEl = document.querySelector('#signed-in') as HTMLElement;
const kindEl = document.querySelector('#kind') as HTMLSelectElement;
const titleEl = document.querySelector('#title') as HTMLInputElement;
const bodyEl = document.querySelector('#body') as HTMLTextAreaElement;
const messageEl = document.querySelector('#message') as HTMLElement;
let sourceUrl = '';
let pageTitle = '';

async function init() {
  const result = await send({ type: 'get-state' });
  if (result.state) {
    renderStatus(
      signedInEl,
      result.state.settings.signedIn,
      result.state.settings.signedIn
        ? 'Connected to Ozer'
        : 'Not signed in — open Options to connect',
    );
    const pending = result.state.pendingCapture;
    if (pending) {
      kindEl.value = pending.kind;
      titleEl.value = pending.title;
      bodyEl.value = pending.body;
      sourceUrl = pending.url;
      pageTitle = pending.pageTitle;
    }
  }
}

document.querySelector('#save')?.addEventListener('click', async () => {
  const result = await send({
    type: 'capture',
    payload: {
      kind: kindEl.value as CaptureKind,
      title: titleEl.value,
      body: bodyEl.value,
      url: sourceUrl,
      pageTitle,
    },
  });
  messageEl.textContent = result.ok
    ? 'Saved to Ozer.'
    : (result.error ?? 'Save failed');
  messageEl.className = result.ok ? 'ok-text' : 'error';
});

void init();
