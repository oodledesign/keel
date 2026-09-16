# Survey Workspace v2 — schema recon (Build 0)

Building-surveyor only. Snapshot of `origin/main` at `d73d9595` (16 September 2026) plus open PRs **#172** and **#173**. British English. No product UI in this build.

Walkthrough (Ben Carey + Dan): create project with address autofill → auto EPC / flood → Level 2 or 3 on **one** template (level drives field visibility) → on site pick a **section** then dictate + photos (AI cleanup only; **not** section inference; same section accumulates) → offline on-device STT + sync with data / wifi photo control + compress → desk section pages (text then photos, sidebar) → ProForms-style phrase book (shared + personal, insert as separate blocks, bulk import) → AI gap check → firm-branded PDF → pipeline enquiry → quote (L2 + L3) → accepted + terms → booked → surveyed.

Critical: sections, not chapters; section → sub-item codes (for example **F3**); no room hierarchy boxes; EPC via `get-energy-performance-data.communities.gov.uk` with platform env `GOV_UK_EPC_API_BEARER_TOKEN`.

---

## 1. Inventory on main

### 1.1 Workspace seed (merged)

| Item | Location | Notes |
|------|----------|--------|
| `space_type = building-surveyor` | `20261014120000_building_surveyor_workspace.sql` | First-class workspace. Modules: dashboard, pipeline, clients, proposals, notes, docs, tasks, team, settings. |
| Survey reports | `proposals.kind = survey_report` | Reuses the proposal writer. |
| RICS heading seed | `content_templates` slug `rics-home-survey` | Flat `<h2 data-section>` list. Same headings as Phase 1 `BUILDING_SURVEY_SECTIONS`. |
| Pipeline stages | `pipeline_deals.stage` + `pipeline-stages.ts` | `enquiry`, `quoted`, `accepted`, `booked`, `surveyed`, `reported`, `lost`. |
| Photo pin | `docs.proposal_id`, `docs.pinned_section_key` | Section pin on the shared docs model. |

Nav: `building-surveyor-account-navigation.config.tsx` (Dashboard, Pipeline, Clients, Meetings, Surveys, Notes, Tasks, Team).

### 1.2 Phase 1 — capture hub (#162, merged)

Migration `20261215120000_survey_capture_phase1.sql`.

| Column / table | Purpose |
|----------------|---------|
| `proposals.survey_type` | Thin template key (`rics_hss_l2`, `rics_hss_l3`, commercial, …). **Not** a 2\|3 visibility driver. |
| `meeting_transcripts.proposal_id` | Site session hangs off the survey. |
| `docs.photo_role` | `archive` \| `curated`. |
| `survey_observations` | Editable notes grouped onto **Phase 1 section keys** (`windows`, `roof_coverings`, …). |

Code: `report-sections.ts` (32 headings + **keyword / AI routing**), `survey-types.ts`, hub at `app/home/[account]/surveys`, native API `lib/native/surveys.ts`.

**Capture model today:** paste or upload a transcript → `groupSurveyObservations` **infers** a section per paragraph → observations appear under those headings. This is the opposite of v2 (surveyor picks the section first).

### 1.3 Phase 2 — style, photos, share (#163, merged)

Migration `20261216120000_survey_capture_phase2.sql`.

| Item | Purpose |
|------|---------|
| `survey_style_examples` | Past reports used to condition draft tone. |
| `docs.caption`, `docs.curated_sort_order` | Curated photo captions and order. |
| `proposals.photo_share_token` / `photo_share_enabled` | Client bulk photo share, not embedded in the PDF. |

AI: `survey-photo-curate.ts`, `survey-style-distill.ts`, `survey-report-generate.ts` (section JSON → HTML / blocks). Settings: Survey style.

### 1.4 Path A — address-first + offline iOS (#165, merged)

Migration `20261216120000_survey_path_a_field_constraints.sql`.

- Survey reports may exist **without** a client or deal (`proposals_client_or_deal`).
- Site sessions may link through `proposal_id` only.
- iOS: create a survey from a title / address string; `OfflineSurveyQueue` stores creates, sessions, and photos until ACK.
- Recording UI (`SurveyRecordView`) is a **meeting-style** live caption session — no section picker, no per-section accumulation, no wifi-only photo control, no compress policy.

**Address is the survey title**, not structured fields. No UPRN, postcode, or flood columns on main before this PR.

### 1.5 #168 — `body_document` block builder (merged)

Migration `20261217120000_survey_report_body_document.sql`.

- `proposals.body_document` jsonb: heading / text / image / divider.
- Compiled to `content_html` for the portal.
- Survey edit page is a campaign-style canvas. Image blocks pick curated photos.
- PDF paginates and embeds PNG / JPG.
- Ordinary proposals keep the HTML textarea.

Keep this pipeline. P5 brands and slots it; do not invent a second document model.

### 1.6 What main does **not** have

| Gap | Status |
|-----|--------|
| `survey_level` 2\|3 | Added in this PR. |
| Structured address / UPRN | Added in this PR (names aligned with #173). |
| Flood columns | Added in this PR (placeholders). |
| `survey_epc` table + GOV.UK client | **#173 OPEN**, not on main. Do not duplicate here. |
| Phrase banks / RICS element codes on observations | **#172 OPEN**. |
| Clonable L2 / L3 templates | **#172 OPEN** (two system keys — see gap table). |
| Section-first iOS capture | Missing (P3). |
| Desk section pages (text then photos) | Missing (P4). Hub is grouped observations + one report canvas. |
| AI gap check | Missing (P4). |
| Quote L2 + L3 + terms on accepted | Pipeline stages exist; commercial copy and terms do not (P6). |

---

## 2. Near-main PRs (not merged)

### 2.1 #172 — templates + GoReport phrase banks (OPEN)

Branch `cursor/survey-templates-phrase-banks-0b55`. Migration timestamp **`20261218120000_survey_templates_phrase_banks.sql`**.

Ships:

- Full L3 catalogue A–N plus D1–D9, E1–E9, F1–F7, G1–G3, H1–H3, I1–I4, J1–J5; L2 subset including `J.valuation`.
- `survey_observations.condition_rating` (`1` / `2` / `3` / `NA` / `NI`) and `rics_code`.
- `survey_templates` (workspace clones of **two** system keys: `rics_hss_l2` / `rics_hss_l3`).
- `proposals.survey_template_id`.
- `survey_phrase_banks` (`personal` \| `workspace`) + `survey_phrases`.
- GoReport xlsx import; insert phrase **into the current observation** (`||a/b||` chips, `||describe||` blanks).
- Assembles template slots into the **existing** `body_document` compiler.

**v2 conflict:** walkthrough is **one template**, level drives visibility. #172 models two clonable shells. Phrase insert mutates the current note rather than appending a **separate block**.

**This PR:** lands the shared catalogue (same codes / keys as #172) as the v2 source of truth. #172 should rebase onto it and stop maintaining a second list.

### 2.2 #173 — GOV.UK EPC auto-pull (OPEN)

Branch `cursor/surveyor-gov-uk-epc-e671`. Migration timestamp **`20261218120000_survey_epc.sql`** (same clock as #172 — one will need a rename on merge).

Ships:

- `proposals.survey_property_address`, `survey_property_postcode`, `survey_uprn`.
- `survey_epc` (one certificate per survey, pulled / override columns, RLS gated to building-surveyor).
- Server client for `get-energy-performance-data.communities.gov.uk`.
- Env: **`GOV_UK_EPC_API_BEARER_TOKEN` only** (Turbo `globalEnv`, not `NEXT_PUBLIC_`).
- Confirm address → auto-pull; Refresh keeps surveyor overrides.
- Feeds Energy (J) / About the property. Flood called out as a later neighbour.

**This PR:** copies the three address column names with `IF NOT EXISTS`. Does **not** create `survey_epc`. P1 should land or rebase #173, then add flood fetch beside it.

---

## 3. Gap table — keep / dual-write / replace

| Area | On main / near main | v2 need | Action |
|------|---------------------|---------|--------|
| `proposals.kind = survey_report` | Main | Survey project row | **Keep** |
| `proposals.survey_type` (many keys) | Main | One template, L2 \| L3 | **Dual-write** `survey_level` ↔ `rics_hss_l2` / `rics_hss_l3`. Hide other keys in P1 UI. |
| `survey_level` 2\|3 | This PR | Visibility driver | **Keep** (new) |
| Phase 1 `BUILDING_SURVEY_SECTIONS` (32 keys + keyword AI) | Main | Section → sub-item codes; no inference | **Dual-write** keys that overlap. **Replace** routing in P3. |
| v2 `SURVEY_SECTION_CATALOGUE` | This PR | Shared catalogue + L2/L3 flags | **Keep**. #172 rebases onto it. |
| AI `groupSurveyObservations` | Phase 1–2 / Path A upload | AI **cleanup only**; surveyor picks section | **Replace** for new captures. Leave keyword helper for legacy transcripts. |
| `survey_observations` | Phase 1 | Accumulate dictation under a picked section | **Keep** table. P3 sets `section_key` / later `rics_code` from the picker, not the model. |
| `meeting_transcripts.proposal_id` | Phase 1 / Path A | Site audio / STT | **Keep**. P3 may add a section key on the session or keep one session per section burst. |
| iOS meeting-style recorder | Path A | Section-first; offline STT; wifi photo flag; compress | **Replace** UI in P3. **Keep** `OfflineSurveyQueue` shape; extend payloads. |
| Photo archive / curated / share token | Phase 2 | Photos under the picked section; desk shows text then photos | **Keep** docs model. P3 writes `pinned_section_key` at capture. P4 orders text then photos. |
| `body_document` + PDF | #168 | Firm-branded PDF | **Keep**. P5 adds brand chrome and slot order (photos then heading + rating + narrative). |
| Style examples | Phase 2 | Optional tone | **Keep** for draft polish. Not the phrase book. |
| Phrase banks (#172) | OPEN | ProForms shared + personal; insert as **separate blocks**; bulk import | **Keep** tables when #172 lands. **Replace** insert UX in P2 (new text block, do not merge into the open note). |
| Two system templates (#172) | OPEN | One template | **Replace** product model with `survey_level`. Workspace brand clone can stay as one shell. |
| EPC table + client (#173) | OPEN | Auto EPC on address confirm | **Keep** when merged. Do not re-create here. |
| Address / UPRN columns | This PR (= #173 names) | Autofill + EPC / flood | **Keep** |
| Flood placeholders | This PR | Auto flood beside EPC | **Keep** columns. P1 fills them. |
| Pipeline stages | Main | enquiry → quote (L2+L3) → accepted + terms → booked → surveyed | **Keep** stage keys. P6 adds quote amounts + terms, not new stages. |
| Room hierarchy | None | Explicitly none | **Keep** absent. Catalogue is by building element. |

---

## 4. Schema this PR adds

Migration `20261219120000_survey_workspace_v2_prep.sql` (after #172 / #173 timestamps).

| Column | Why |
|--------|-----|
| `proposals.survey_level` `smallint` CHECK 2\|3 | Visibility driver. Backfilled from `survey_type`. |
| `proposals.survey_property_address` | Same name as #173. |
| `proposals.survey_property_postcode` | Same name as #173. |
| `proposals.survey_uprn` | Same name as #173. Partial index. |
| `proposals.survey_flood_risk_band` | P1 placeholder. |
| `proposals.survey_flood_risk_summary` | P1 placeholder. |
| `proposals.survey_flood_source` | `placeholder` \| `manual` \| `gov_uk`. |
| `proposals.survey_flood_raw_json` | Audit payload. |
| `proposals.survey_flood_fetched_at` | Last pull. |

Not added (owned by open PRs or later builds):

- `survey_epc` (#173)
- `survey_templates` / phrase tables (#172)
- `survey_observations.rics_code` / `condition_rating` (#172)
- Capture-session section key (P3)

Constants: `survey-section-catalogue.ts` (75 items, `visibleOnLevels`, `onSitePickable`, `ricsCode`). Helpers on `survey-types.ts`: `normalizeSurveyLevel`, `surveyLevelFromType`, `surveyTypeForLevel`.

---

## 5. Merge notes for the next agent

1. **#172 and #173 share `20261218120000_…`.** The second to merge must rename its file.
2. **Address columns** are safe either order (`IF NOT EXISTS`).
3. **#173** should add `survey_epc` only — do not add a second address trio.
4. **#172** should import `SURVEY_SECTION_CATALOGUE` (or re-export it) instead of a private `rics-catalogue.ts`.
5. Typegen after this migration is applied: `pnpm supabase:web:typegen`.
6. Stay inside `building-surveyor` / `survey_report`. No work / commercial / personal behaviour.

---

## 6. Build order (P1–P6)

See the pull request body. Short form:

1. **P1** — Address autofill, confirm, EPC (#173), flood fill, set `survey_level`.
2. **P2** — Phrase panel on #172 tables; insert as separate blocks; bulk import.
3. **P3** — iOS section-first capture; on-device STT; sync + photo wifi/compress.
4. **P4** — Desk section pages; sidebar; AI gap check (not section inference).
5. **P5** — Firm-branded PDF from `body_document`.
6. **P6** — Pipeline quote (L2+L3) → accepted + terms → booked → surveyed.
