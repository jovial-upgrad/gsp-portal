# GSP screen-to-reference map

For each GSP 3.0 screen: what it must do (from the brief, audits and field research), the references to open first, and the patterns to start from. "G-NN" = `assets/gsp-references/gsp-NN-*.webp` (see `gsp-reference-manifest.md`). "VL-NN" = item NN in `visual-library-manifest.md` (`assets/visual-library-references/`).

These are starting points. If a better structure serves the job, use it and say why.

## Contents
- Agency (RP) screens: Home, Applications list, Application detail, New application, Students list, Student record, Find courses, Course detail and compare, Earnings, Profile and team, Sign-up and onboarding, Ask GSP, Notifications
- GSP screens: Admissions queues, BAP agencies, IP partners and universities, Data team held changes, Finance commissions / rules / payouts, Recruitment manager, Super admin, Leadership overview
- Shared moments: documents, duplicates, success, empty states, AI progress

---

## Agency (RP) screens

### RP Home
**Job:** answer the three agency questions in one glance — where is it and who has it, what do I need to do, what will I earn.
**Open first:** G-16 (applyr pipeline, profile completion, deadline cards), G-13 (weighted welcome, stepper, three-way split), G-18 (action-required card), G-04 (task cards, quick requests), G-48 (quick-create chips, counter tiles), VL-17 and VL-26 (greeting with a summary number).
**Patterns:** greeting + "N things need you" headline; owner tiles (Needs you amber / With GSP violet / With university blue) as the primary filter; one action-required card; a task list sorted by due date with the action inline (Upload, Add details); pipeline as a single stacked bar by stage; earnings strip (next payout, expected, pipeline); GSP team card with phone and WhatsApp; deadlines and updates feed.

### Applications list
**Job:** scan hundreds of applications, see who has each one, act on the ones that need the agency.
**Open first:** G-16 (status tabs), G-40 (list + detail, active filters bar), G-09 (table with status pills and progress), G-22 (rows with counts and pills).
**Patterns:** owner / stage tabs with counts; search across student, passport, ID, university reference; table rows with student, course + university, intake, counsellor, status pill in owner colour with plain words, "at this step: 2 days · usually 13"; row action Act / View; export; optional split view on wide screens.

### Application detail
**Job:** one place for the whole application: who has it, what's needed now, documents, chat, history, commission.
**Open first:** G-35 (process bar + Up Next + score with reasons + timeline), G-33 (fact strip + status step line), G-34 (stage path at top), G-38 (tabs + persistent chat column + document thumbnails), G-37 (documents and approval inside chat).
**Patterns:** header with student, course, university, intake, owner chip; fact strip (application ID, university reference, counsellor, GSP contact, You earn); 8-stage tracker with checks and the current stage in its owner colour; a "Needs you: 1 thing to do" banner with the single primary action; tabs Summary / Documents / Chat / Activity that never move; chat full-width when open.

### New application
**Job:** pick a student and a course intake with as few inputs as possible; check eligibility first.
**Open first:** G-06 (match + why), G-44 (verdict ring with word label), G-35 (stepped sequence), ApplyBoard audit learnings in `gsp-product-context.md`.
**Patterns:** one modal with a context card (student, course, intake, deadline) always visible; step 1 eligibility with the exact reason and "Update details"; intake picker showing Open / Likely open and deadline; documents-to-expect list; backups optional.

### Students list
**Job:** find a student, see how ready their profile is and how many applications they have.
**Open first:** G-09 (table with progress rings), G-34 / G-35 (person cards with a score).
**Patterns:** table with avatar initials, name, contact, counsellor (reassignable), profile readiness ring or %, applications count, owner of next action; filters (incomplete, no application, counsellor).

### Student record
**Job:** fill once, reuse everywhere; show what's missing and which applications are waiting on it.
**Open first:** G-16 (profile completion with missing items), G-13 (stepper), G-27 / G-45 (person header, channel tiles, duplicates), G-05 / G-07 (document folders).
**Patterns:** header with name, contact copy buttons, "Student link — let them fill it"; course matches count; section progress strip (Personal, Academics, Work, Tests, Documents) each with "N to add"; passport-read fields marked; documents as folders by type; applications list.

### Find courses
**Job:** results only after the five required inputs; hide what the student can't apply to; explain every verdict.
**Open first:** G-14 (filter rail, browse-first page, trending, fields), G-06 (profile chips, match cards, why this matches, AI nudge), G-44 (verdict ring + reasons), G-12 (assistant card with suggestions).
**Patterns:** "Search for" panel with the five inputs and a plain-language box; profile chips when a student is picked; Student view switch that hides earnings; course card with university, course, campus, intake pills "closes in N days", tuition, application fee, IELTS, You earn, eligibility verdict with reason, Checked date, Apply / Details / Compare / shortlist; Priority tag; sort by best match.

### Course detail and compare
**Open first:** G-14 (university photos), G-15 (photo tiles), G-33 (fact strip), G-12 (assistant beside content).
**Patterns:** facts first (fees, duration, intakes, entry requirements for the student's country with "from University › PG" source), then description; compare up to five in columns with differences highlighted; branded shortlist PDF.

### Earnings
**Job:** what will I earn, when, and how close is the next tier — with no claims to raise.
**Open first:** G-13 (three-way money split), G-01 (banded scale with marker, big number with freshness), G-17 (month grid timeline, slide-over detail), G-40 (KPI strip, payout panel), G-37 (comparison bar), G-28 (gauge + insights).
**Patterns:** headline "AUD 12,810 on the way"; Expected / Confirmed / Invoiced / Paid / Clawed back tiles; tier progress as bands (70% → 75% at 10 → 80% at 30) with "3 more enrolments"; rates table per university (GSP earns, you get); by-student list with status, when and amount; statements with download.

### Profile, team and branches
**Open first:** G-09 (team list), G-27 (contact tiles), G-23 (process columns for onboarding).
**Patterns:** business and bank details with clear "needed before first payout"; documents with review status; team list with role, branch, status and invite; branches.

### Sign-up and onboarding
**Job:** one short form; course search opens immediately; documents and agreement as a visible checklist.
**Open first:** G-13 (stepper), G-16 (completion checklist), G-11 (folder with review progress), G-02 (upload input), G-47 (success).
**Patterns:** single-page sign-up with email code; then a checklist (Upload documents → BAP review → Activated → Sign agreement) showing what each step unlocks; status in plain words; BDM contact.

### Ask GSP (assistant)
**Open first:** G-29 / G-42 (floating panel, suggested questions, dark input), G-04 (quick requests), G-12 (assistant card), G-31 (side panel), G-36 (working state); VL-40 to VL-43; read `ai-feature-patterns.md` first.
**Patterns:** labelled "Ask GSP" with a colour distinct from the brand primary; suggested questions tied to the current page; answers cite the application or rule they came from; clear handover to a person; never changes data.

### Notifications
**Open first:** G-21 (activity timeline), G-39 (rules as sentences).
**Patterns:** bell with count, "Needs you" list; per-type preferences written as sentences, Immediate / Daily digest, WhatsApp.

---

## GSP screens

### Admissions: My queues
**Job:** work the region's queues fast; only exceptions reach a person.
**Open first:** G-35 (My Work list + record side by side), G-34 (work queue cards with scores), G-40 (list + detail, selected row inverted), G-48 (counter tiles with deltas), G-30 (personal score card), G-43 (mismatch counts on a record).
**Patterns:** queue tabs with counts (Check and submit, Decisions to record, Flagged documents, Check and send, Verification, Emails to action, Outcomes to confirm); today's stats (done, minutes per item); list + detail with the evidence beside the document; one primary action per item (Verify / Ask for re-upload, Place on application, Confirm); "Open as the RP".

### BAP: agencies
**Open first:** G-11 (folder with review progress), G-45 (match / duplicate flags), VL-12 (compliance gauge "97% Good Standing").
**Patterns:** status tabs with counts; agency detail with documents to approve one by one, check results (matches a rejected agency), timeline, BDM and admissions mapping; Activate / Send back / Reject.

### IP team: partners and universities
**Open first:** G-23 (process columns), G-33 (status step line), G-36 (AI progress), G-22 (status rows), VL-32 (workflow builder).
**Patterns:** partner list with type, RM, agreement end, status; partner detail with Negotiating → Reading agreement → Confirm fields → Set-up → Active tracker; AI-drafted fields shown beside the agreement with low-confidence highlights; three set-up checklists in parallel.

### Data team: held changes
**Open first:** G-33 (old → new with status), G-48 (published log), G-25 (KPI with sparkline).
**Patterns:** KPIs (live courses, checked in 30 days, held, bot accuracy); each held change with reason, old → new, source and Approve / Reject; auto-published log.

### Finance: commissions, rules, payouts
**Open first:** G-40 (KPI strip, list + detail, payout), G-33 (status step line, quick links with counts), G-39 (rules as sentences), G-24 (node editor, only if a visual rule builder is needed), VL-49.
**Patterns:** tiles (ready to invoice, awaiting payment, paid this month, payouts this week); exceptions with two actions each; rules with source clause and a second-person activation; weekly payout batch with approve.

### Recruitment manager: my partners
**Open first:** G-22 (rows with counts and status), G-18 (client pipeline), G-34 (score cards).
**Patterns:** partners table with this month / last month / change, live applications, status (Active, Dropping, Onboarding, Dormant) and a nudge action per row.

### Super admin
**Open first:** G-39 (rules as sentences), G-24 (workflow canvas), G-09 (table).
**Patterns:** users and roles table (one role, one scope); onboarding assignment rules; destination workflow switches.

### Leadership overview
**Open first:** G-18 (Sankey funnel + action card), G-22 (analytics), G-29 (insight sentence), G-25 (average-time KPIs), G-32 (workflow cards), VL-27, VL-33.
**Patterns:** headline KPIs vs target; funnel created → enrolled with conversion; where applications wait (agencies / GSP / universities) with medians; longest waiting with GSP; by-region table.

---

## Shared moments

- **Documents:** G-02, G-07, G-10, G-11, G-37, G-47, VL-9. Folders with counts, "From the student record" reuse, upload with Auto naming, status Missing → Uploaded → Checking → Verified / Flagged → Rejected with reason.
- **Duplicate student:** G-45. Show the existing record and its owner, match %, merge or request access.
- **Success:** G-47 (sheet with thumbnails and Confirm), G-20 ("3 of 5 completed"). Use for application submitted, offer received, enrolled (peak-end).
- **Empty states:** G-14 (browse-first), G-09 ("Nothing to do" wording from the brief: "Nothing to do. You'll see it here and on WhatsApp when something is needed").
- **AI working:** G-36 ("Preparing the result 63%"), G-04 (voice), G-02 (Auto). Always show progress for anything over ~400 ms.
