# Ozer — App Store submission kit

Draft copy for App Store Connect. Edit freely; character limits are Apple's.

## App information

| Field | Value |
| --- | --- |
| Name (30) | Ozer |
| Subtitle (30) | Tasks, notes & meetings |
| Bundle ID | `so.ozer.app` |
| SKU | `ozer-ios` |
| Primary category | Productivity |
| Secondary category | Business |
| Privacy policy URL | https://www.ozer.so/privacy-policy |
| Support URL | https://www.ozer.so/contact |
| Marketing URL | https://www.ozer.so |
| Copyright | 2026 Ozer |
| Age rating | 4+ (no objectionable content; user-generated messages are between workspace members only) |
| Price | Free (accounts are created and billed on the web) |

## Promotional text (170)

Your Ozer workspace in your pocket. Record meetings and surveys on-device, review tasks pulled from email, and keep family memories — even offline.

## Description (4000)

Ozer brings your workspaces — personal, family, and business — into one calm iPhone app.

TODAY AT A GLANCE
See what's due, what's overdue, outstanding invoices, and this month's money in and out the moment you open the app.

TASKS AND REVIEW
Add, edit, and tick off tasks for any workspace. Ozer pulls suggested tasks out of your meetings and email; accept, tweak, or dismiss them in a tap.

MEETINGS, RECORDED ON YOUR IPHONE
Record in-room meetings with live captions. Transcription and speaker labelling run entirely on your iPhone, and keep going with the screen locked. Save as a meeting for a client or as a note.

BUILDING SURVEYS (FOR SURVEYORS)
Dictate observations straight into RICS sections, take tagged site photos, and keep working with no signal. Everything syncs when you're back online.

NOTES AND DICTATION
Type or dictate notes. They save instantly and sync later if you're offline.

MESSAGES
Chat with your team, clients, and project contacts, with photos and push notifications.

FAMILY MEMORIES
Capture moments with photos, video, and voice notes, tag your children, and see their age at every memory.

CLIENTS, PROJECTS AND INVOICES
Look up clients and contacts, follow projects on a list, timeline, or board, and check invoice status on the go.

An Ozer account is required. Sign in with Apple, Google, or an email link.

## Keywords (100, comma-separated, no spaces)

tasks,notes,meetings,transcription,dictation,survey,RICS,surveyor,planner,family,memories,invoices,CRM

## What's new (version 1.0)

The first release of Ozer for iPhone.

## Screenshots

Required: 6.9" iPhone (1320 × 2868 portrait), 3–10 images. Suggested order:

1. Home — Today dashboard with finance chart
2. Meeting recording with live captions and speaker pills
3. Task review (suggested tasks from meetings and email)
4. Survey section dictation with photos
5. Messages thread
6. Family memories timeline

Use the demo account so no real client data appears.

## App Privacy (App Store Connect questionnaire)

Tracking: **No** — Ozer does not track users across apps or websites. No third-party analytics or advertising SDKs are included.

Data collected, all **linked to the user**, all for **App Functionality** only:

| Category | Data type | Why |
| --- | --- | --- |
| Contact Info | Email Address | Sign-in and account |
| Contact Info | Name | Profile display (Sign in with Apple / Google) |
| Identifiers | User ID | Account and workspace membership |
| User Content | Audio Data | Survey dictation and memory voice notes the user chooses to upload |
| User Content | Photos or Videos | Survey photos, memory media, message images |
| User Content | Other User Content | Tasks, notes, meetings, messages |

Not collected: location, contacts, health, financial info (invoices are business records the user owns, shown read-only), browsing history, diagnostics, usage data. Meeting audio stays on the device.

These match `Ozer/PrivacyInfo.xcprivacy`. Update both if a new SDK or data type is added.

## Export compliance

`ITSAppUsesNonExemptEncryption = NO` is set in `Info.plist`. Ozer only uses Apple's built-in HTTPS and Keychain encryption, which is exempt.

## App Review information

**Sign-in:** demo account (enter the email, a password field appears)

- Username: `appreview@ozer.so`
- Password: _set in Supabase; paste here when submitting_

**Notes for the reviewer:**

> Ozer is the iPhone companion to the Ozer web app (app.ozer.so). Accounts are created by signing in with Apple, Google, or an email link; there are no in-app purchases.
>
> To sign in with the demo account, type appreview@ozer.so in the email field — a password field replaces the "Email me a link" button.
>
> The demo account belongs to several workspaces. Tap Menu → the workspace name at the top to switch between Personal, a Family workspace, a Studio workspace, and a Surveyor workspace — each shows different features.
>
> Background audio: Meetings (Menu → Meetings → Start a new meeting) and Surveys (Surveyor workspace → Surveys) record from the microphone and keep recording when the screen locks, so a surveyor or meeting host can pocket the phone. Transcription runs on-device using Apple's Speech framework. Live captions need a real iPhone; the Simulator shows a placeholder.
>
> Account deletion: Menu → Personal settings → Delete account. Deletion locks the account immediately and removes the data after 30 days.

## Before you submit

- [ ] Create `appreview@ozer.so` in Supabase (Authentication → Users → Add user, auto-confirm, set a password). Make sure the Email provider allows password sign-in.
- [ ] Give the demo account a Personal, Family, Studio (`work_design`) and Surveyor (`building_surveyor`) workspace with realistic sample data — no real client data.
- [x] Account deletion API is live in production (`NEXT_PUBLIC_ENABLE_PERSONAL_ACCOUNT_DELETION=true` comes from `apps/web/.env`).
- [ ] Set `APNS_KEY_ID`, `APNS_P8` and `APNS_PRODUCTION=true` in production Vercel and redeploy. TestFlight and App Store builds use Apple's production push server.
- [ ] Check https://www.ozer.so/privacy-policy mentions on-device speech, microphone, camera, and photo use, and how to delete an account.
- [ ] Bump `CURRENT_PROJECT_VERSION` in `Config/Shared.xcconfig` for each upload.
