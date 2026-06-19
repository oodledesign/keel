-- Seed published blog posts for Ozer marketing blog

INSERT INTO public.blog_posts (
  slug,
  title,
  meta_description,
  excerpt,
  content,
  primary_keyword,
  secondary_keywords,
  og_title,
  og_description,
  canonical_url,
  featured_image_url,
  featured_image_alt,
  author_name,
  author_url,
  reading_time_minutes,
  schema_json,
  status,
  published_at
) VALUES (
  'why-i-built-my-own-all-in-one-tool-for-freelancers',
  'I''ve Been Running a Freelance Agency for 5 Years. Here''s Why I Eventually Just Built My Own Tool.',
  'After 5 years running a web design agency and trying every all-in-one tool for freelancers, I gave up and built Ozer — one connected system for client work, email, invoicing, and everything in between.',
  'I''m not a startup. I''m a freelancer who got tired of his own chaos. I''ve been running a web design agency for five years. What started as a clean, manageable operation grew into something I genuinely couldn''t keep on top of.',
  $body$# I've Been Running a Freelance Agency for 5 Years. Here's Why I Eventually Just Built My Own Tool.

I'm not a startup. I'm a freelancer who got tired of his own chaos.

I've been running a web design agency for five years. What started as a clean, manageable operation grew into something I genuinely couldn't keep on top of. Not because the work got harder — it didn't, really — but because every new client, every new project, every new process added another tool to the pile. And at some point the pile became the job.

## The All-in-One Tool Problem (It's Not What You Think)

Before I built anything, I tried everything.

I'm the kind of person who gets obsessive about software. I've tested more productivity apps than I care to admit. I've been through every category: email assistants, task managers, CRM tools, project management platforms, note-taking apps, client portals, invoicing software. I've had every tab open and every system "set up."

The problem was never the individual apps. Most of them were fine. Some were genuinely great. The problem was that they didn't know about each other.

My email assistant didn't know which client a thread was related to. My project management tool didn't know an invoice had gone out. My client portal had no idea a meeting had happened. I was the connective tissue between all of it — manually updating, copy-pasting, cross-referencing — and that's an exhausting place to be when you're also supposed to be doing the actual work.

I kept searching for an all-in-one tool for freelancers that actually understood how a solo agency operates. Something that didn't just bundle a few features together under one logo, but genuinely connected the dots across the whole business.

I couldn't find it. So I built it.

## What I Actually Needed

After five years, I had a pretty clear picture of where the friction lived:

**Client communication was fragmented.** Emails, meeting notes, WhatsApp messages — they all lived in different places, and none of them were tied to a project. Following up on anything meant going on an archaeology dig through three different inboxes.

**Client portals were an afterthought.** I was either sending files via email (chaotic), using a shared Google Drive folder (slightly less chaotic but deeply unsexy), or paying for a separate portal tool that had no connection to the rest of my workflow.

**Invoicing was completely disconnected from everything else.** I'd finish a project, switch to a different piece of software, manually re-enter the client's details, and send the invoice. Then that invoice would sit in a completely separate system with no link back to the project it came from.

**Nothing had context.** That's what I kept coming back to. Every tool I used was smart within its own walls and completely blind to everything outside them. As a freelancer, your context *is* the business. The client, the project, the conversation, the invoice — they're one thing, not four separate things.

## So I Built Ozer

Ozer is the all-in-one tool for freelancers and agencies that I couldn't find anywhere else. One system for everything that actually matters in a client-facing business:

- **Email assistant** — your inbox connected to your client and project data, so every email has context and nothing slips through
- **Client portals** — a clean, professional space for each client, built into the same system you're already working in
- **Project management** — tasks, timelines, and deliverables tied directly to clients and work, not floating in a vacuum
- **Invoicing** — send invoices from the same place you manage the project, with client details already there

But more than any individual feature, what makes Ozer different is that these things actually talk to each other. The email is linked to the client. The client is linked to the project. The project generates the invoice. Nothing lives in isolation.

## Who This Is For

If you're running a solo agency, a small studio, or working as an independent consultant — and you're currently held together by a combination of willpower and browser tabs — Ozer is being built for you.

This isn't enterprise software with a freelancer pricing tier bolted on. It's built from the ground up for the way solo operators actually work: wearing every hat, context-switching constantly, and needing tools that keep up rather than slow you down.

## Where We Are Now

Ozer is nearly there. I've been building it in the gaps between client work for over a year, and we're approaching launch. The first agency is in the process of onboarding now.

If you want to be one of the first, early access is open. Come find me on Instagram where I'm building this in public — or comment **OZER** on any post and I'll send you early access details via DM.

It's taken five years of running an agency to know exactly what I needed to build. I think it was probably worth the wait.$body$,
  'all-in-one tool for freelancers',
  ARRAY['freelance agency management software','client portal for agencies','freelance business software'],
  'I''ve Been Running a Freelance Agency for 5 Years. Here''s Why I Eventually Just Built My Own Tool.',
  'After 5 years running a web design agency and trying every all-in-one tool for freelancers, I gave up and built Ozer — one connected system for client work, email, invoicing, and everything in between.',
  'https://ozer.so/blog/why-i-built-my-own-all-in-one-tool-for-freelancers',
  NULL,
  NULL,
  'Dan Potter',
  'https://ozer.so',
  5,
  $schema1${
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "I've Been Running a Freelance Agency for 5 Years. Here's Why I Eventually Just Built My Own Tool.",
  "description": "After 5 years running a web design agency and trying every all-in-one tool for freelancers, I gave up and built Ozer — one connected system for client work, email, invoicing, and everything in between.",
  "keywords": "all-in-one tool for freelancers, freelance agency management software, client portal for agencies, freelance business software",
  "author": {
    "@type": "Person",
    "name": "Dan Potter",
    "url": "https://ozer.so"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Ozer",
    "url": "https://ozer.so",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ozer.so/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ozer.so/blog/why-i-built-my-own-all-in-one-tool-for-freelancers"
  },
  "articleSection": "Founder Story",
  "inLanguage": "en-GB"
}$schema1$::jsonb,
  'published',
  now()
),
(
  'ai-meeting-notes-app-mac-freelancers',
  'Your AI Meeting Notes App Shouldn''t Be an Island',
  'Most AI meeting note tools are great at transcribing — but the notes go nowhere. Ozer Assistant captures any call or in-person meeting, separates speakers, extracts tasks, sends follow-ups, logs everything to your second brain, and lets you dictate into any input on your Mac.',
  'There''s a whole category of AI meeting notes tools that are genuinely impressive. Real-time transcription, clean summaries, solid speaker labels. Some of them are excellent products. But when the call ends, the notes just sit there.',
  $body$# Your AI Meeting Notes App Shouldn't Be an Island

There's a whole category of AI meeting notes tools that are genuinely impressive. Real-time transcription, clean summaries, solid speaker labels. Some of them are excellent products.

But here's the problem: when the call ends, the notes just... sit there. In their own app. In their own world. Disconnected from the client record, disconnected from your tasks, disconnected from your inbox. You end up copy-pasting summaries into project tools, manually creating follow-up tasks from action items you spotted in a wall of transcript, and writing emails that reference things you half-remember from a call thirty minutes ago.

The tool did its job. You still have to do all the connecting.

I built Ozer Assistant because I needed a desktop meeting notes app that actually finished the job.

## Starts Before the Meeting Does

Ozer Assistant connects to your calendar. When a meeting's coming up, it sends you a reminder so you're not scrambling to find the link. It also reads the event details and autofills the meeting context automatically — client name, project, what the meeting's about — so you're not setting anything up manually before every call.

By the time you hit record, it already knows what you're recording and why.

## Works on Any Call. Works in the Room.

Most AI meeting transcription tools fall into the same trap: they only work if you're on a video call, usually through a specific platform.

Ozer Assistant captures two audio streams simultaneously — your microphone and your system audio — which means it works across Zoom, Google Meet, Microsoft Teams, or anything else running on your Mac. No bot joining the call. No permissions to request. No awkward "an AI is recording this meeting" moment with clients.

But the bigger differentiator is what happens when you're not on a video call at all.

**In-room meetings.** Client visits, team sessions, coffee shop conversations — Ozer Assistant handles these too. Using the microphone, it captures everyone in the room and separates speakers automatically, so the transcript doesn't come back as one undifferentiated block of text. You can actually tell who said what. For anyone who's tried to use a transcription tool for an in-person meeting and ended up with an unusable mess, this is the thing that changes it.

The transcript appears live on screen as the conversation happens. You can glance at it, add a quick note mid-meeting, or just leave it running and come back to it after.

## Quick Notes, Right There

Sometimes you want to capture something in the moment — a thought, a question, a thing you don't want to forget. Ozer Assistant has a quick notes panel built in. Notes you add during a meeting are stored directly in Ozer, attached to the meeting record, not floating in a separate app.

You can also add tasks on the spot. If a client asks for something and you want to capture it immediately as an action item rather than hoping you catch it in the transcript later, it's one tap.

## Dictate Into Anything, Anywhere on Your Mac

This one isn't about meetings at all — it's just genuinely useful.

Press **fn** anywhere on your Mac and start speaking. Ozer Assistant transcribes what you say and types it directly into whatever input you're focused on — an email, a document, a task field, a Slack message, a search box. Anywhere text goes, your voice can go instead.

It's not basic dictation. The output comes back with correct punctuation, proper grammar, and sentences that actually read like you meant to write them. You can speak naturally and what appears on screen is clean, polished text — not a phonetic dump that you then have to go back and fix.

If you'd rather not have it type in place, there's a copy button. One click and the transcript is on your clipboard, ready to paste wherever you need it.

The practical upshot is that Ozer Assistant becomes less of a meetings tool you open occasionally and more of a layer that lives permanently in your workflow. Composing an email? Speak it. Writing up project notes? Speak them. Capturing a thought while you're mid-task? Fn, say it, done.

## What Happens When the Call Ends

This is where most AI meeting note tools stop. This is where Ozer Assistant keeps going.

When you finish recording, the transcript syncs to Ozer and the following happens automatically:

**Tasks are extracted.** Action items from the conversation are identified and added directly to your project task list. Not a list of things to manually copy across later — actual tasks, in the right project, ready to work from.

**Follow-up emails are drafted.** Based on the conversation, Ozer drafts the post-meeting email — summary, next steps, anything that was agreed. You review and send. The email logs back against the client record automatically.

**It goes into your second brain.** Every meeting, every transcript, every note is embedded and indexed in Ozer's knowledge layer. Search for a client name, a topic, a decision made six months ago — it surfaces the relevant context with a citation back to the source. Over time, your entire history of client conversations becomes queryable.

## The Connected Part Is the Point

There are tools that transcribe brilliantly. The gap isn't transcription quality — it's that the output goes nowhere useful.

When your meeting notes are connected to your projects, your tasks, your inbox, and your client history, they stop being a passive record and start being something you actually use. The meeting becomes part of the workflow rather than a break from it.

That's what Ozer Assistant is built to be: not a standalone notes app, but the part of your business OS that handles everything meetings — from the calendar reminder before they start to the tasks and emails that come out the other end.

## Where It Stands

Ozer Assistant is in the final stages before public release. The full loop — record, transcribe, sync, extract tasks, draft email, index to second brain — is working in production. We're currently working through Mac distribution requirements before wider release.

If you want early access, I'm building all of this in public on Instagram. Comment **OZER** on any post and I'll send you details via DM.

---

*Ozer Assistant is a macOS desktop app. Works across Zoom, Google Meet, Microsoft Teams, and any other call tool, as well as in-person meetings. No audio is written to disk during recording.*$body$,
  'AI meeting notes app for Mac',
  ARRAY['automatic meeting transcription Mac','meeting recorder for freelancers','desktop meeting notes app','in-person meeting transcription','voice dictation Mac'],
  'Your AI Meeting Notes App Shouldn''t Be an Island',
  'Most AI meeting note tools are great at transcribing — but the notes go nowhere. Ozer Assistant captures any call or in-person meeting, separates speakers, extracts tasks, sends follow-ups, and logs everything to your second brain.',
  'https://ozer.so/blog/ai-meeting-notes-app-mac-freelancers',
  NULL,
  NULL,
  'Dan Potter',
  'https://ozer.so',
  6,
  $schema2${
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Your AI Meeting Notes App Shouldn't Be an Island",
  "description": "Most AI meeting note tools are great at transcribing — but the notes go nowhere. Ozer Assistant captures any call or in-person meeting, separates speakers, extracts tasks, sends follow-ups, logs everything to your second brain, and lets you dictate into any input on your Mac.",
  "keywords": "AI meeting notes app for Mac, automatic meeting transcription Mac, meeting recorder for freelancers, desktop meeting notes app, in-person meeting transcription, voice dictation Mac",
  "author": {
    "@type": "Person",
    "name": "Dan Potter",
    "url": "https://ozer.so"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Ozer",
    "url": "https://ozer.so",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ozer.so/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ozer.so/blog/ai-meeting-notes-app-mac-freelancers"
  },
  "articleSection": "Product",
  "inLanguage": "en-GB"
}$schema2$::jsonb,
  'published',
  now()
)
ON CONFLICT (slug) DO NOTHING;
