import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import {
  observeMeetSpeakers,
  parseMeetCode,
  sanitizeSpeakerName,
} from './speaker-detect';

function dom(html: string) {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document;
}

describe('parseMeetCode', () => {
  it('reads the Meet code from the URL', () => {
    expect(parseMeetCode('https://meet.google.com/abc-defg-hij')).toBe(
      'abc-defg-hij',
    );
  });

  it('ignores non-Meet URLs', () => {
    expect(parseMeetCode('https://example.com/abc-defg-hij')).toBeNull();
  });
});

describe('sanitizeSpeakerName', () => {
  it('drops fused Them / generic labels', () => {
    expect(sanitizeSpeakerName('Them')).toBeNull();
    expect(sanitizeSpeakerName('You')).toBeNull();
    expect(sanitizeSpeakerName('Ada Lovelace')).toBe('Ada Lovelace');
  });
});

describe('observeMeetSpeakers', () => {
  const href = 'https://meet.google.com/abc-defg-hij';

  it('reads an active speaker from aria-label', () => {
    const document = dom(`
      <div data-self-name="Dan"></div>
      <div data-participant-id="1">
        <div aria-label="Ada Lovelace is speaking"></div>
        <div>Ada Lovelace</div>
      </div>
      <div data-participant-id="2"><div>Sam Smith</div></div>
    `);

    const observation = observeMeetSpeakers(document, href);
    expect(observation.name).toBe('Ada Lovelace');
    expect(observation.source).toBe('active_speaker');
    expect(observation.confidence).toBe('high');
    expect(observation.meetCode).toBe('abc-defg-hij');
    expect(observation.participants).toEqual(
      expect.arrayContaining(['Ada Lovelace', 'Sam Smith']),
    );
  });

  it('falls back to captions when no speaking indicator exists', () => {
    const document = dom(`
      <div role="region" aria-label="Captions">
        <strong>Sam Smith</strong>
        Let’s ship the speaker bridge
      </div>
    `);

    const observation = observeMeetSpeakers(document, href);
    expect(observation.name).toBe('Sam Smith');
    expect(observation.source).toBe('caption');
  });

  it('degrades to unknown instead of Them when names are missing', () => {
    const document = dom(`<div>Meeting is starting</div>`);
    const observation = observeMeetSpeakers(document, href);
    expect(observation.name).toBeNull();
    expect(observation.source).toBe('unknown');
    expect(observation.confidence).toBe('low');
  });
});
