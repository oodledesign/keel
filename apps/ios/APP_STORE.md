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
Dictate observations straight into your survey report sections, take tagged site photos, and keep working with no signal. Everything syncs when you're back online.

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

commercial,agent,surveyor,inspection,survey,landlord,tenant,lettings,viewing,CRM,meeting,transcribe,tasks

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

**Notes for the reviewer** (also the reply to the 2.1 "Information Needed" request of 10 October 2026; paste into both, under 4,000 characters):

```text
PURPOSE AND AUDIENCE
Ozer (ozer.so) is a workspace app for small businesses and sole traders, mainly commercial property agents, building surveyors and studios doing client work, plus a free personal workspace for anyone. These people spend much of the day away from a desk at viewings, site surveys and client meetings, and usually juggle voice memos, notes apps, spreadsheets and email to keep track. Ozer lets them record a meeting or survey on the phone (transcribed on the device, even with no signal), turn it into follow-up tasks, look up clients, check projects and invoices, and message their team, in the same workspace they use on the web.

Ozer is open to the public: anyone can create an account by signing in with Apple, Google or an email link and gets a free personal workspace. It is not limited to one organisation. Business plans are bought by businesses on our website; the app has no purchasing, prices or links to buy.

HOW TO USE IT
Demo account: appreview@ozer.so (password in App Review Information). Type the email and a password field replaces "Email me a link".
After signing in, Ozer asks whether it may send meeting, survey and note text to the AI providers listed below; nothing is uploaded until the user answers. The demo account sees this on first sign-in. Change it in Menu > Personal settings > AI features.
The demo account is in four workspaces. Open Menu (last tab) and tap the workspace name to switch: Personal, Harland Reed Property (commercial property), Calloway Building Surveyors (surveyor) and Northfold Studio (client work).
- Home: today's tasks, money in and out, suggested tasks.
- Meetings: Menu > Meetings > Start a new meeting. Captions are transcribed on the device and recording continues with the screen locked. Live captions need a real device.
- Surveys: Calloway workspace > Surveys > open a survey > a section to dictate or add photos.
- Tasks and Review: accept, edit or dismiss tasks suggested from meetings.
- Clients, Projects, Invoices, Disposals: Harland Reed workspace.
- Messages: Menu > Messages. Press and hold another person's message (e.g. Sam Carter) to report it or block them, or use the ... menu in a conversation. Reports reach us by email and are reviewed within 24 hours. Unblock in Menu > Personal settings > Blocked people.
- Account deletion: Menu > Personal settings > Delete account. The account locks immediately and its data is removed after 30 days. Please test deletion with a new Sign in with Apple account so the demo account stays available.

EXTERNAL SERVICES
- Supabase: sign-in, database and file storage
- Vercel: hosts the Ozer API the app talks to (app.ozer.so)
- Sign in with Apple and Google Sign-In
- Apple Push Notification service
- Apple Speech framework: on-device transcription; audio is not uploaded for transcription
- Hugging Face: one-time download of an open-source speaker-labelling model that runs on the device
- Anthropic (Claude), Google Gemini and Voyage AI, only if the user allows it: meeting summaries, suggested tasks, survey dictation clean-up and workspace search
- Mapbox: UK address search for surveys, called from our server
- Google Workspace and Microsoft 365: optional email and calendar connections set up on the web
- ZeptoMail and Amazon SES: sign-in links and notification emails
- Stripe: web billing only, not used in the app

REGIONS
Available in the United Kingdom, United States and Canada. The app works the same in every region. Survey templates and address search are built for UK building surveys; nothing else varies by region.

REGULATION AND THIRD-PARTY MATERIAL
Ozer is not a regulated service (no financial, medical or legal services) and contains no licensed third-party content. Professionals such as surveyors use it to record their own work and remain responsible for their professional standards. Ozer is not affiliated with any professional body.
```



## Before you submit

- [x] Create `appreview@ozer.so` in Supabase (Authentication → Users → Add user, auto-confirm, set a password). Make sure the Email provider allows password sign-in.
- [x] Give the demo account a Personal, Commercial Property (`commercial_property`), Surveyor (`building_surveyor`) and Studio (`work_design`) workspace with realistic sample data — no real client data. Seeded by `apps/web/scripts/seed-app-review-demo.mts --production --write` (Harland Reed Property, Calloway Building Surveyors, Northfold Studio, plus a demo teammate `hi+demo-sam@ozer.so` for Messages). Re-run it to reset the data after a review.
- [x] Screenshots: iPhone 6.9" (1320×2868) and iPad 13" (2064×2752), seven each, captured from the demo account.
- [x] Account deletion API is live in production (`NEXT_PUBLIC_ENABLE_PERSONAL_ACCOUNT_DELETION=true` comes from `apps/web/.env`).
- [x] AI permission (guideline 5.1.2(i)), from build 3: the app asks after sign-in and holds uploads until answered; the server skips Claude, Gemini and Voyage for anyone who declines. Before each submission, clear the demo account's answer so the reviewer sees the prompt (the seed script does this).
- [x] Enable the Apple provider in production Supabase (Authentication → Sign In / Providers → Apple) with Client ID `so.ozer.app`. The native iOS flow needs no secret key; that's only for web OAuth and expires every 6 months.
- [x] Set `APNS_KEY_ID`, `APNS_P8` and `APNS_PRODUCTION=true` in production Vercel and redeploy. TestFlight and App Store builds use Apple's production push server.
- [x] Privacy policy covers the iPhone and iPad app (on-device speech, microphone, camera, photos, push) and in-app account deletion.
- [ ] Bump `CURRENT_PROJECT_VERSION` in `Config/Shared.xcconfig` for each upload. Don't change it in Xcode's Build Settings: that writes an override into `project.pbxproj` and later xcconfig bumps are ignored.