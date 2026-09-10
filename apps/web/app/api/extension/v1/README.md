# Chrome extension API (`/api/extension/v1`)

Cookie-free JSON for the Ozer Chrome extension. Authenticate with a `keel_` device token (`Authorization: Bearer …`) — the same tokens as the Mac Assistant recorder API. Do not send Makerkit cookies.

Connect tokens are created at `/connect/chrome-extension` (Chrome identity redirect or a one-time code) and exchanged at `POST /api/recorder/connect/exchange`.

## Status

`GET /api/extension/v1/status` → `{ ok, account_id, workspaces }`

## Capture

`POST /api/extension/v1/capture`

```json
{ "kind": "task" | "note" | "contact", "account_id?", "title?", "body?", "url?", "page_title?", "email?", "phone?" }
```

Creates a workspace task, note, or contact stub. `kind=contact` is a People stub (name required); it does not scrape credentials.

## Speaker events

Live stamps belong on the local Assistant
(`POST http://127.0.0.1:18791/v1/meet/speaker-stamps`, body
`{ name, startedAt, endedAt }` or `{ events: [...] }`). Temporary aliases:
`http://127.0.0.1:17834/v1/health` and `POST /v1/speaker-events`. This route is
the cloud buffer when Assistant is offline, and a pull path for a later
Assistant build.

`POST /api/extension/v1/speaker-events`

```json
{
  "session_id": "abc-defg-hij",
  "meet_url": "https://meet.google.com/abc-defg-hij",
  "meet_code": "abc-defg-hij",
  "account_id": "<optional uuid>",
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

`name` is `null` when Meet did not expose a participant name. Do not rename that bucket to `Them`.

`GET /api/extension/v1/speaker-events?session_id=…&since=…` returns `{ items }` for Assistant to merge into the current transcript.

## Extract tasks (post-call)

`POST /api/extension/v1/extract-tasks`

```json
{
  "account_id": "<uuid>",
  "title": "Weekly sync",
  "content": "transcript or summary text…",
  "create_note": true,
  "create_tasks": false,
  "events": []
}
```

Saves a meeting-transcript note (unless `create_note=false`), runs the existing workspace task extract, and optionally creates tasks. Prefer `create_tasks=false` and review at `extract_path`.

## Local Assistant contract

See `apps/ozer-extension/README.md`. The Mac app should expose:

- `GET http://127.0.0.1:18791/v1/health`
- `POST http://127.0.0.1:18791/v1/meet/speaker-stamps`

Temporary aliases for older local builds: `GET http://127.0.0.1:17834/v1/health`
and `POST http://127.0.0.1:17834/v1/speaker-events`.

Native messaging host `so.ozer.assistant` is documented as a later alternative. The extension does not tap WebRTC audio or run ASR.
