import type { ExtensionSpeakerEvent } from '../lib/protocol';
import { observeMeetSpeakers } from '../lib/speaker-detect';
import { SpeakerTurnTracker } from '../lib/speaker-events';

const CHIP_ID = 'ozer-meet-bridge-chip';
const POLL_MS = 700;

const tracker = new SpeakerTurnTracker();
let sessionId = '';
let lastMeetCode: string | null = null;
let pending: ExtensionSpeakerEvent[] = [];
let assistantOnline = false;
let assistantRecording = false;
let lastObservationName: string | null = null;

function ensureSession(meetCode: string | null) {
  const next = meetCode || `meet-${location.pathname}`;
  if (next !== sessionId) {
    const leftover = tracker.flush(new Date().toISOString());
    if (leftover) pending.push(leftover);
    sessionId = next;
  }
  lastMeetCode = meetCode;
}

function upsertChip() {
  let chip = document.getElementById(CHIP_ID);
  if (!chip) {
    chip = document.createElement('div');
    chip.id = CHIP_ID;
    chip.setAttribute('data-ozer-meet-bridge', 'true');
    document.documentElement.appendChild(chip);
  }

  const name = lastObservationName;
  let text = 'Ozer · looking for speakers';
  if (name) {
    text = `Ozer · ${name} speaking`;
  } else if (lastMeetCode) {
    text = 'Ozer · speaker name unavailable';
  }
  if (assistantRecording) {
    text = `${text} · Assistant recording`;
  } else if (!assistantOnline) {
    text = `${text} · Assistant offline`;
  }
  chip.textContent = text;
  chip.title =
    'Ozer reads visible Meet names (tiles, captions, speaking indicator). It does not tap call audio.';
}

function flushEvents() {
  if (pending.length === 0 || !sessionId) return;
  const events = pending.splice(0, pending.length);
  void chrome.runtime.sendMessage(
    {
      type: 'meet-speaker-events',
      sessionId,
      meetUrl: location.href,
      meetCode: lastMeetCode,
      events,
    },
    (response: { assistantOnline?: boolean } | undefined) => {
      assistantOnline = Boolean(response?.assistantOnline) || assistantOnline;
    },
  );
}

function tick() {
  const observation = observeMeetSpeakers(document, location.href);
  ensureSession(observation.meetCode);
  lastObservationName = observation.name;
  const closed = tracker.observe(observation, new Date().toISOString());
  if (closed) {
    pending.push(closed);
    if (pending.length > 200) pending.splice(0, pending.length - 200);
  }

  void chrome.runtime.sendMessage(
    {
      type: 'meet-status',
      meetCode: observation.meetCode,
      speakerName: observation.name,
    },
    (
      response:
        | { assistantOnline?: boolean; assistantRecording?: boolean }
        | undefined,
    ) => {
      assistantOnline = Boolean(response?.assistantOnline);
      assistantRecording = Boolean(response?.assistantRecording);
      upsertChip();
    },
  );

  upsertChip();
  if (pending.length >= 1) flushEvents();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const closed = tracker.flush(new Date().toISOString());
    if (closed) pending.push(closed);
    flushEvents();
  }
});

let scheduled = false;
function scheduleTick() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    tick();
  }, 250);
}

const observer = new MutationObserver((records) => {
  const relevant = records.some((record) => {
    const target = record.target;
    if (!(target instanceof Element)) return true;
    return !target.closest(`#${CHIP_ID}`);
  });
  if (relevant) scheduleTick();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['aria-label', 'data-is-speaking', 'data-speaking'],
});

setInterval(tick, POLL_MS);
tick();
