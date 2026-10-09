# Ozer — App Store submission kit

Draft copy for App Store Connect. Edit freely; character limits are Apple's.

## App information


| Field              | Value                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Name (30)          | Ozer                                                                                      |
| Subtitle (30)      | Workspaces for property & more                                                            |
| Bundle ID          | `so.ozer.app`                                                                             |
| SKU                | `ozeriosapp`                                                                              |
| Primary category   | Productivity                                                                              |
| Secondary category | Business                                                                                  |
| Privacy policy URL | [https://www.ozer.so/privacy-policy](https://www.ozer.so/privacy-policy)                  |
| Support URL        | [https://www.ozer.so/contact](https://www.ozer.so/contact)                                |
| Marketing URL      | [https://www.ozer.so](https://www.ozer.so)                                                |
| Copyright          | 2026 Daniel Potter                                                                        |
| Age rating         | See "Age rating questionnaire" below (override to 13+)                                    |
| Price              | Free (accounts are created and billed on the web)                                         |
| Availability       | United Kingdom, United States and Canada for launch. EU storefronts need Digital Services Act trader verification first. |




## Promotional text (170)

One app for every workspace: commercial property, surveying, client work and personal. Record viewings, meetings and surveys on-device, even offline.

## Description (4000)

Ozer brings all your workspaces — commercial property, surveying, client work and your personal life — into one calm app for iPhone and iPad. Each workspace gets the tools that suit it, so you can go from a viewing to a site survey to your own to-do list without switching apps.

TODAY AT A GLANCE
Open a workspace and see what's due, what's overdue, outstanding invoices, and this month's money in and out.

COMMERCIAL PROPERTY WORKSPACES
Made for agents who spend the day out of the office. Record viewings and client meetings with live captions, turn what was agreed into follow-up tasks, look up landlord, tenant and applicant contacts, and keep projects and fee invoices moving between appointments. Listings, brochures and portal feeds are managed in Ozer on the web.

BUILDING SURVEYS
Dictate observations straight into RICS report sections, take tagged site photos, and keep working with no signal. Everything syncs when you're back online.

MEETINGS, RECORDED ON YOUR DEVICE
Record in-room meetings with live captions. Transcription and speaker labelling run entirely on your iPhone or iPad, and keep going with the screen locked. Save the result to a client or as a note.

TASKS AND REVIEW
Add, edit and tick off tasks in any workspace. Ozer suggests tasks from your meetings and email; accept, tweak or dismiss them in a tap.

CLIENTS, PROJECTS AND INVOICES
Look up clients and contacts, follow projects as a list, timeline or board, and check invoice status on the go.

NOTES AND DICTATION
Type or dictate notes. They save instantly and sync later if you're offline.

MESSAGES
Chat with your team, clients and project contacts, with photos and push notifications.

YOUR PERSONAL WORKSPACE
Keep your own tasks, people, shopping list and meal plans alongside your work.

An Ozer account is required. Sign in with Apple, Google or an email link.

## Keywords (100, comma-separated, no spaces)

commercial,agent,surveyor,RICS,survey,landlord,tenant,lettings,viewing,CRM,meeting,transcribe,tasks

Apple already indexes the name and subtitle, so "Ozer", "workspaces" and "property" don't need repeating here.

## What's new (version 1.0)

The first release of Ozer for iPhone and iPad.

## Screenshots

Required, 3–10 images each:

- 6.9" iPhone: 1320 × 2868 portrait (iPhone 17 Pro Max simulator).
- 13" iPad: 2064 × 2752 portrait (iPad Pro 13-inch simulator). Required because the app runs on iPad.

Suggested order:

1. Home — Today dashboard with finance chart (commercial property workspace)
2. Meeting recording with live captions and speaker pills
3. Survey section dictation with photos
4. Clients and contacts in a commercial property workspace
5. Task review (suggested tasks from meetings and email)
6. Messages thread

Use the demo account so no real client data appears.

## App Privacy (App Store Connect questionnaire)

Tracking: **No** — Ozer does not track users across apps or websites. No third-party analytics or advertising SDKs are included in the app. PostHog (and Sentry, when added) run on the website only; if either is ever added to the app, or to server code that records app requests against a user, update these answers.

Data collected, all **linked to the user**, all for **App Functionality** only:


| Category     | Data type          | Why                                                                |
| ------------ | ------------------ | ------------------------------------------------------------------ |
| Contact Info | Email Address      | Sign-in and account                                                |
| Contact Info | Name               | Profile display (Sign in with Apple / Google)                      |
| Identifiers  | User ID            | Account and workspace membership                                   |
| User Content | Audio Data         | Survey dictation and memory voice notes the user chooses to upload |
| User Content | Photos or Videos   | Survey photos, memory media, message images                        |
| User Content | Other User Content | Tasks, notes, meetings, messages                                   |


Not collected: location, contacts, health, financial info (invoices are business records the user owns, shown read-only), browsing history, diagnostics, usage data. Meeting audio stays on the device.

These match `Ozer/PrivacyInfo.xcprivacy`. Update both if a new SDK or data type is added.

## Age rating questionnaire

Messages can come from teammates and from clients, and Task review shows snippets of the user's own email. That counts as messaging. It isn't "user-generated content" in Apple's sense, which means content broadly distributed to other users; Ozer's messages are private to a workspace.

| Question | Answer |
| --- | --- |
| Parental controls | No |
| Age assurance | No |
| Unrestricted web access | No (links open in Safari; there is no in-app browser) |
| User-generated content | No (nothing is broadly distributed; messages are private to a workspace) |
| Messaging and chat | Yes |
| Advertising | No |
| Profanity or crude humour | None |
| Horror or fear themes | None |
| Alcohol, tobacco or drug use or references | None |
| Medical or treatment information | No |
| Health or wellness topics | No |
| Mature or suggestive themes | None |
| Sexual content or nudity | None |
| Graphic sexual content and nudity | None |
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Prolonged graphic or sadistic violence | None |
| Guns or other weapons | None |
| Simulated gambling | None |
| Contests | No |
| Gambling | No |
| Loot boxes | No |
| Social media | No (no public profiles, feeds or following) |
| Social media disabled for users under 13 | No (the app doesn't call the Declared Age Range API) |
| Made for Kids | No |

The calculated rating is 4+. Messages aren't moderated and can come from people outside the user's team, so it's overridden to **13+** (step 7, "Override to Higher Age Rating"). A higher rating costs a business app nothing. Saved in App Store Connect on 8 October 2026.

Guideline 1.2 (user-generated content) asks for a way to report objectionable messages, a way to block abusive users, terms that don't tolerate abuse, and published contact details. All four are covered:

- **Report:** press and hold someone else's message → Report message…, or the … menu in a conversation → Report conversation…. Reports are saved to `chat_message_reports` and emailed to hi@ozer.so, with a promise to review within 24 hours.
- **Block:** the same press-and-hold menu, the … menu, or "Also block" on the report form. A blocked person's messages are hidden, a one-to-one chat with them leaves the inbox, and they no longer trigger push, in-app or email notifications. Unblock in Personal settings → Blocked people.
- **Terms:** the Terms of Service acceptable-use section bans objectionable messages and states the 24-hour review.
- **Contact:** hi@ozer.so on the website and in the terms.

## Export compliance

`ITSAppUsesNonExemptEncryption = NO` is set in `Info.plist`. Ozer only uses Apple's built-in HTTPS and Keychain encryption, which is exempt.

## App Review information

**Sign-in:** demo account (enter the email, a password field appears)

- Username: `appreview@ozer.so`
- Password: *testaccountpassword*

**Notes for the reviewer:**

> Ozer is the iPhone and iPad companion to the Ozer web app (app.ozer.so). Accounts are created by signing in with Apple, Google, or an email link; there are no in-app purchases.
>
> To sign in with the demo account, type [appreview@ozer.so](mailto:appreview@ozer.so) in the email field — a password field replaces the "Email me a link" button.
>
> The demo account belongs to several workspaces. Tap Menu → the workspace name at the top to switch between Personal, a Commercial Property workspace, a Surveyor workspace, and a Studio workspace — each shows different features.
>
> Background audio: Meetings (Menu → Meetings → Start a new meeting) and Surveys (Surveyor workspace → Surveys) record from the microphone and keep recording when the screen locks, so a surveyor or meeting host can pocket the phone. Transcription runs on-device using Apple's Speech framework. Live captions need a real iPhone or iPad; the Simulator shows a placeholder.
>
> Account deletion: Menu → Personal settings → Delete account. Deletion locks the account immediately and removes the data after 30 days.
>
> Reporting and blocking: in Messages, press and hold another person's message to report it or block them, or use the … menu at the top of a conversation. Reports go to our team, who review them within 24 hours. Blocked people are listed under Menu → Personal settings → Blocked people.



## Before you submit

- [x] Create `appreview@ozer.so` in Supabase (Authentication → Users → Add user, auto-confirm, set a password). Make sure the Email provider allows password sign-in.
- [x] Give the demo account a Personal, Commercial Property (`commercial_property`), Surveyor (`building_surveyor`) and Studio (`work_design`) workspace with realistic sample data — no real client data. Seeded by `apps/web/scripts/seed-app-review-demo.mts --production --write` (Harland Reed Property, Calloway Building Surveyors, Northfold Studio, plus a demo teammate `hi+demo-sam@ozer.so` for Messages). Re-run it to reset the data after a review.
- [x] Screenshots: iPhone 6.9" (1320×2868) and iPad 13" (2064×2752), seven each, captured from the demo account.
- [x] Account deletion API is live in production (`NEXT_PUBLIC_ENABLE_PERSONAL_ACCOUNT_DELETION=true` comes from `apps/web/.env`).
- [x] Set `APNS_KEY_ID`, `APNS_P8` and `APNS_PRODUCTION=true` in production Vercel and redeploy. TestFlight and App Store builds use Apple's production push server.
- [x] Privacy policy covers the iPhone and iPad app (on-device speech, microphone, camera, photos, push) and in-app account deletion.
- [ ] Bump `CURRENT_PROJECT_VERSION` in `Config/Shared.xcconfig` for each upload. Don't change it in Xcode's Build Settings: that writes an override into `project.pbxproj` and later xcconfig bumps are ignored.