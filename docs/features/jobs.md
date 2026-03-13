CRM V1

Roles
	•	Owner/Admin/Staff: CRUD clients + CRUD client notes
	•	Contractor: read-only clients ONLY if linked to jobs/projects the contractor is assigned to (via assignments table). No client create/edit/delete. No notes create/delete.
	•	Client role: no CRM access.

Client fields (V1)
	•	display_name (required)
	•	company_name (optional)
	•	email (optional)
	•	phone (optional)
	•	address_line_1, address_line_2, city, postcode, country (optional)
	•	created_by, created_at, updated_at
	•	org_id on every row

Notes (V1)
	•	Notes are internal only
	•	Fields: org_id, client_id, author_user_id, note, created_at
	•	Owner/Admin/Staff can create/list/delete notes
	•	Contractors cannot access notes

Requirements
	•	/dashboard/clients list: search + pagination
	•	Client detail drawer: view + edit + notes
	•	Job history: read-only list of jobs/projects linked to client (jobs.client_id)

Data tables
	•	clients, client_notes

RLS and scoping
	•	All data is org-scoped (org_id)
	•	Contractors can SELECT clients only if there exists a visible assigned job/project for that client
	•	Contractor access is enforced in RLS (not just UI)