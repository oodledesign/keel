# RLS manual test checklist: Job events (Visits & Meetings)

Use this checklist to verify Row Level Security and permissions for `job_events` and `job_event_assignments`.

## Prerequisites

- Two team accounts (org A and org B), each with at least one job.
- In org A: at least one Owner/Admin, one Staff, one Contractor (assigned to a job via job_assignments), and optionally a Client.
- Create at least one job event (visit/meeting) in org A linked to a job that the contractor is assigned to.
- Create one job event in org B.

---

## 1. Two orgs isolation

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | As a member of org A only, open Job Detail for a job in org A and go to Visits & Meetings tab. | You see only org A’s events for that job. |
| 1.2 | As a member of org B only, open Job Detail for a job in org B. | You see only org B’s events. You do not see any org A events. |
| 1.3 | As a user in both org A and org B, switch to org A, open a job, Visits & Meetings. | Only that job’s events (org A) are listed. |
| 1.4 | Same user, switch to org B, open a job, Visits & Meetings. | Only that job’s events (org B) are listed. No org A data. |

---

## 2. Contractor visibility

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | As a **Contractor** assigned to the job (via job_assignments), open that job’s Visits & Meetings tab. | You see all events for that job (upcoming and previous). |
| 2.2 | As the same Contractor, open a job you are **not** assigned to (same org). | You do not see that job’s events (or the tab shows no events / access denied as designed). |
| 2.3 | Create an event in org A and assign **only** a specific contractor to the event (via job_event_assignments). As that contractor, open the job (even if not on job_assignments) and go to Visits & Meetings. | Contractor sees the event because they are assigned to the event. |
| 2.4 | As a different contractor (not assigned to the job and not assigned to that event), open the same job. | They do not see that event. |

---

## 3. Contractor cannot edit schedule / title / assignments

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | As a **Contractor** who can see an event (assigned to job or event), open the event in the drawer. | You can edit **Prep notes** and **Outcome notes** only. Title, type, start/end, location, follow-up, and Assigned team are read-only or hidden. |
| 3.2 | As Contractor, submit the form with only notes changed. | Save succeeds; only prep_notes/outcome_notes are updated (server enforces notes-only). |
| 3.3 | Attempt to change title or scheduled time via API/direct update (e.g. Supabase client with contractor auth). | RLS allows UPDATE on the row, but the server action should only apply notes; if the app sends other fields, backend should ignore or reject non-notes changes for contractor. |

---

## 4. Staff can create / edit / delete and manage assignments

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | As **Owner**, **Admin**, or **Staff**, open a job’s Visits & Meetings tab. | “Add visit/meeting” button is visible. |
| 4.2 | Create a new event: title, type (site_visit or meeting), start (and optionally end), location, prep notes. | Event is created and appears in Upcoming. |
| 4.3 | Open the new event in the drawer. Edit title, date/time, location, outcome notes. Save. | Changes are persisted. |
| 4.4 | Add one or more team members to “Assigned team” for the event. | Assignments appear; listJobEventAssignments returns them. |
| 4.5 | Remove an assignment. | Assignment is removed. |
| 4.6 | As Staff, delete the event. | Event is deleted and no longer appears in the list. |
| 4.7 | As **Contractor**, try to open “Add visit/meeting” or delete an event (if UI allowed). | Contractor does not see Add button; cannot delete; server rejects create/delete if called. |

---

## 5. Client role

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | As a user with **Client** role on the account (and no Owner/Admin/Staff/Contractor), open the job detail page. | No access to job (or no Visits & Meetings data). Client has no access to job_events in V1. |

---

## Quick reference

- **job_events**: SELECT for org members (except client); Contractor only if assigned to job or to event. INSERT/UPDATE/DELETE for Owner/Admin/Staff; Contractor UPDATE only (app restricts to notes).
- **job_event_assignments**: SELECT for events the user can see; INSERT/UPDATE/DELETE for Owner/Admin/Staff only.
- All writes must use the correct `account_id`; RLS policies prevent cross-org and spoofing.
