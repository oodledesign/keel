# Ozer Chrome extension (MV3)

Unpacked extension for Google Meet speaker stamps and capture-to-Ozer. It does **not** run Parakeet/Whisper or tap WebRTC audio.

## Load unpacked

From the monorepo root:

```bash
pnpm install
pnpm --filter ozer-extension build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → `apps/ozer-extension/dist`

## Connect

1. Open the extension **Options** (or the popup) → **Connect workspace**
2. Sign in on `app.ozer.so` (or set Ozer origin to `http://localhost:3000` for local web)
3. Chrome returns a one-time code; the extension exchanges it for a `keel_` token

Fallback: create a personal API token in Ozer → Settings → Desktop recorder, paste it on the options page.

Local web: you may need to allow `http://localhost:3000` when Chrome prompts for the optional host permission.

## Verify (Dan)

### Meet speaker bridge (P0)

1. Start **Ozer Assistant** on the Mac if you have a build that implements the local HTTP contract below. If not, the extension still buffers events to Ozer.
2. Join a Meet with **two remote people** (names visible on tiles; turn captions on if you can).
3. Load the unpacked extension; confirm the plum chip appears: `Ozer · {name} speaking`.
4. When a name is missing the chip says **speaker name unavailable** — it will not collapse remotes into `Them`.
5. Popup status should show the current speaker. Options → **Enable Google Meet speaker bridge** can turn this off.

### Capture on a random page (P1)

1. Open any article. Select a sentence.
2. Right-click → **Capture to Ozer**, or press **⌘⇧O** / **Ctrl+Shift+O**.
3. Save as task, note, or contact stub. Confirm it appears in the connected workspace.

### Post-call → tasks

In the popup, paste a transcript/summary (≥ 20 characters) and click **Extract tasks**. That calls `/api/extension/v1/extract-tasks` (note + existing Ozer extract). Review in the workspace extract page.

### Meet helpers

On a Meet tab, the popup can **copy the meeting link** and **Open in Ozer**. The chip nudges whether Assistant is recording. No audio tap.

## What Meet allows (honest)

Meet has no public speaker API. The content script reads the DOM a participant already sees:

| Source | When it works | Confidence |
| --- | --- | --- |
| `aria-label` “X is speaking” | Often, if Meet exposes it | high |
| Tile / `data-is-speaking` | When the grid shows names | medium |
| Captions | Only if captions are on | medium |
| Nothing usable | Crowded grid, names hidden | `name: null` |

Class names change. We prefer `aria-*` and `data-*`. We never scrape cookies or passwords.

## Local Assistant contract (keel-assistant)

Live stamps into the **current** transcript need the Mac app. Hypothesis confirmed: a localhost HTTP receiver is the thinnest path (native messaging host `so.ozer.assistant` is a later alternative; not required for v1).

Default origin: `http://127.0.0.1:17834`

```http
GET /v1/health
→ { "ok": true, "service": "ozer-assistant", "recording": false, "version": "…" }
```

```http
POST /v1/speaker-events
Content-Type: application/json

{
  "sessionId": "abc-defg-hij",
  "meetUrl": "https://meet.google.com/abc-defg-hij",
  "meetCode": "abc-defg-hij",
  "events": [
    {
      "name": "Ada Lovelace",
      "startedAt": "2026-09-10T10:02:00.000Z",
      "endedAt": "2026-09-10T10:04:00.000Z",
      "source": "active_speaker",
      "confidence": "high"
    }
  ]
}
```

If Assistant is down, the extension POSTs the same events to `https://app.ozer.so/api/extension/v1/speaker-events` (keel buffer). Assistant can later `GET /api/extension/v1/speaker-events?session_id=…`.

Companion routes and connect page live in this repo: `apps/web/app/api/extension/v1/README.md`.

## Permissions

`storage`, `activeTab`, `scripting`, `contextMenus`, `identity`, plus host access for Meet, `app.ozer.so`, and `127.0.0.1:17834`. Capture on arbitrary pages uses `activeTab` after a user gesture — not `<all_urls>`.
