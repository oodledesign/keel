# @kit/scheduling

Pure slot computation, Google Calendar free/busy, and conferencing providers
(Zoom / Microsoft Teams) for Ozer Scheduling.

## Modules

| Export                              | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `@kit/scheduling`                   | `computeAvailableSlots`, shared types, Google errors       |
| `@kit/scheduling/google`            | `getGoogleClientForWorkspace`, busy intervals              |
| `@kit/scheduling/calendar-provider` | Calendar free/busy interface (Google today; Outlook later) |
| `@kit/scheduling/conferencing`      | Zoom / Teams meeting create + delete                       |

## Conferencing providers

`ConferencingProvider` is intentionally **auth-agnostic**:

```ts
createMeeting({ booking, connection }) → { joinUrl, providerMeetingId }
deleteMeeting({ providerMeetingId, connection })
```

Tokens are loaded and refreshed by `getConferencingConnectionForWorkspace`
(mirrors the Google Calendar 60s proactive refresh pattern). Providers only
receive decrypted `ConferencingConnectionCredentials`.

### Composio / AgentAuth (future)

If we adopt Composio AgentAuth for multi-tenant OAuth, **swap the connection
loader** (or inject credentials from AgentAuth) — do not fork Zoom/Teams
meeting API code. Keep provider auth behind the interface boundary:

1. Connection acquisition / refresh → pluggable
2. `ZoomConferencingProvider` / `TeamsConferencingProvider` → stable

Google Meet is **not** a `ConferencingProvider`; it is created via the Google
Calendar API `conferenceData` path in the booking layer.

## Env

| Provider | Variables                                                                                    |
| -------- | -------------------------------------------------------------------------------------------- |
| Zoom     | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`                                  |
| Teams    | `MICROSOFT_TEAMS_CLIENT_ID`, `MICROSOFT_TEAMS_CLIENT_SECRET`, `MICROSOFT_TEAMS_REDIRECT_URI` |
| Tokens   | `TOKEN_ENCRYPTION_KEY` (shared with Google Calendar encryption)                              |
