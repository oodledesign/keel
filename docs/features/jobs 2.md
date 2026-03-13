Jobs V1 (Operational Core)

Purpose

Jobs are the operational core of Keel. They unlock scheduling (calendar), team assignment, time tracking, and invoicing.

Roles and Access (V1)
	•	Owner/Admin/Staff: full CRUD on jobs, assignments, and job notes within their organisation.
	•	Contractor:
	•	Can view jobs only if assigned to them.
	•	Can update assigned jobs only for: status, actual_minutes (and optionally due_date if you want).
	•	Can add job notes on assigned jobs.
	•	Cannot create jobs.
	•	Cannot manage assignments.
	•	Client: no access in V1 (client portal later).

Status and Priority (V1)

Status (enum / constrained text):
	•	pending
	•	in_progress
	•	on_hold
	•	completed
	•	cancelled

Priority (enum / constrained text):
	•	low
	•	medium
	•	high
	•	urgent

Overdue definition (for metrics):
	•	due_date is in the past AND status is not completed or cancelled.

Data Model (Tables)

jobs

Fields:
	•	id (uuid, PK)
	•	org_id (uuid, required)
	•	client_id (uuid, nullable, FK -> clients.id)
	•	title (text, required)
	•	description (text, nullable)
	•	status (text/enum, required)
	•	priority (text/enum, required)
	•	start_date (date, nullable)
	•	due_date (date, nullable)
	•	estimated_minutes (int, nullable)
	•	actual_minutes (int, nullable)
	•	value_pence (int, nullable)
	•	cost_pence (int, nullable)
	•	created_by (uuid)
	•	created_at, updated_at (timestamptz)

Indexes:
	•	(org_id, status)
	•	(org_id, due_date)
	•	(org_id, client_id)

job_assignments

Purpose: links team members to jobs.
Fields:
	•	id (uuid, PK) OR composite unique key
	•	org_id (uuid, required)
	•	job_id (uuid, FK -> jobs.id, ON DELETE CASCADE)
	•	user_id (uuid, FK -> auth.users.id)
	•	role_on_job (text, nullable) e.g. Lead, Support
	•	created_at, updated_at

Constraints:
	•	UNIQUE(job_id, user_id)

Indexes:
	•	(org_id, user_id)
	•	(org_id, job_id)

job_notes

Purpose: internal notes against a job.
Fields:
	•	id (uuid, PK)
	•	org_id (uuid, required)
	•	job_id (uuid, FK -> jobs.id, ON DELETE CASCADE)
	•	author_user_id (uuid)
	•	note (text, required)
	•	created_at, updated_at

Indexes:
	•	(org_id, job_id)

RLS Rules

General:
	•	All tables are org-scoped via org_id.
	•	Cross-org access must be impossible.

Owner/Admin/Staff:
	•	Can SELECT/INSERT/UPDATE/DELETE jobs, job_assignments, job_notes within org.

Contractor:
	•	jobs:
	•	SELECT only if assigned via job_assignments
	•	UPDATE only on assigned rows (row-level). Field restrictions enforced at app layer.
	•	No INSERT/DELETE
	•	job_assignments:
	•	SELECT only for jobs they can see
	•	No INSERT/UPDATE/DELETE
	•	job_notes:
	•	SELECT only for jobs they can see
	•	INSERT allowed for jobs they can see
	•	No DELETE

Client:
	•	No access to jobs, assignments, notes.

UI Requirements

/dashboard/jobs (List)
	•	Tabs: Active and Completed
	•	Search + pagination
	•	Columns: title, client (if linked), status, priority, due date, value (optional), assigned team summary
	•	Create job button (Owner/Admin/Staff only)

Job Detail (Drawer or /dashboard/jobs/[id])

Sections:
	•	Overview (fields + edit mode)
	•	Notes (list + add; delete Owner/Admin only)
	•	Assignments (list; add/remove Owner/Admin/Staff only)
Contractor view:
	•	read-only except status + actual_minutes + add note

Metrics

Need a server action to return counts per org:
	•	active_jobs_count (not completed/cancelled)
	•	completed_jobs_count (completed)
	•	overdue_jobs_count (due_date < today and not completed/cancelled)