# GSP product context for design

The facts and rules a GSP design has to respect, distilled from the GSP 3.0 Designer Brief (24 Oct 2026), the field report "What Our Agents Told Us" (Sep–Oct 2026), the legacy portal audits (GSP admin, branch admin, counsellor, head office admin; 25 Oct 2026), the ApplyBoard competitor audit, and the PM prototype. If a newer brief or decision contradicts this file, the newer source wins.

## Contents
1. The business in brief
2. Users and roles
3. The four journeys and the eight stages
4. Design rules from the brief
5. What today's portal gets wrong (design against these)
6. What competitors do well (learn from these)
7. Vocabulary
8. Scale and constraints

## 1. The business in brief

upGrad Global Study Partners (GSP) is a B2B platform. Local agencies (recruitment partners, RPs) in India, Vietnam, Bangladesh, Nepal and other countries use it to find courses abroad (Australia, UK, Canada, USA, New Zealand, Ireland, Malaysia), apply for students and track applications to enrolment. GSP has agreements with universities (through institution partners), does the admissions work, and earns a commission when a student enrols, passing 70–85% to the agency. About 50,000 applications a year; a small regional Admissions team; the system does the routine work and people handle exceptions. GSP 3.0 goes live 15 December 2026.

**The three questions every agency screen must answer:** Where is it, and who has it? What do I need to do? What will I earn?

## 2. Users and roles

- **Agency:** RP admin / head office (all branches), branch admin (one branch, invites counsellors), counsellor (own students). Master Partner later.
- **GSP:** BDM / recruitment manager (their agencies, read-only work, stuck alerts), recruitment head (region), BAP (verifies and activates agencies), Admissions and Admissions head (region queues, workload, reassign, override with reason), IP team (universities and agreements), Data team (course data, held changes), Commissions & Finance (rules, exceptions, payouts), Super admin (users, roles, regions, settings), Leadership.
- One role per person; scope by sales region; a record outside scope shows "not found", never "no permission".
- Universities and students don't sign in. Students can fill their own profile through a link.

## 3. The four journeys and the eight stages

1. **Agency joins:** one-page sign-up (search opens immediately) → upload business documents → BAP verifies (send back / approve / reject) → Activated (students and applications open) → agreement signed (commission starts).
2. **University goes live:** agreement uploaded → AI drafts records → people confirm low-confidence fields → set-up checklists (commission rules; profile, campuses, who can apply, submission; courses) → Active → renewal 60 days before end.
3. **Application, eight stages,** each owned by exactly one party:

| Stage | What the agency sees | Who has it |
| --- | --- | --- |
| New | Waiting for your documents | Agency |
| Pre-Screening | GSP is checking the documents | GSP (agency for a re-upload) |
| Application | GSP is submitting to the university | GSP |
| Offer | With the university for a decision | University (agency if more info asked) |
| Verification | Conditional offer: send the conditions; GSP verifying finances | Agency, GSP, university |
| Acceptance | Unconditional offer: pay the deposit; waiting for the CoE | Agency, then university |
| Visa | Lodge the visa; waiting for the decision | Agency, then government |
| Enrolled | Enrolled | Done |

Any stage can end in Withdrawn, Deferred, Rejected, Refused, Not eligible or Did not join. Wording follows the destination (CoE / CAS / I-20 / LOA).

4. **Commission:** enrolled and census passed → university commission line → invoice → university pays → agency line → weekly self-billed statement and payment → year-end tier top-ups. Agency sees Expected → Confirmed → Invoiced → Paid (or Clawed back). The agency never raises a claim.

## 4. Design rules from the brief

1. **Every screen answers "What do I do now?"** Lead with the summary and the next action; detail is one click away.
2. **The frame never changes with the state.** Tabs and sections stay in place; only content changes. Empty sections say so plainly ("Nothing to do. You'll see it here and on WhatsApp when something is needed").
3. **Chat is a first-class, full-width surface,** not a box squeezed beside other content.
4. **Show who has it,** in colour and words: **amber = the agency, violet = GSP, blue = the university.**
5. **Minimal for agencies:** no internal statuses, staff checks, rules or jargon ("entry requirements", never "assessment criteria"). If a field doesn't change what the agency does next, it isn't on their screen.
6. **Never block on judgement.** Warnings explain; only hard rules stop an action.
7. **Every automatic step is visible** in the activity log, with who or what did it.
8. **People act (upload, approve, send); the system moves the status.** No tickets or tasks to create.
9. Navigation: agency left sidebar Home, Applications, Students, Find courses, Earnings, Profile; GSP roles get the same shell with their own menus.
10. Eligibility verdicts: Eligible, Eligible with conditions, Not eligible, Add details to check — always with the reason ("Academics 58%, needs 57% for India").
11. Documents: Missing → Uploaded → Checking → Verified, or Flagged → Rejected with one of seven reasons; upload once, reuse; AI names and checks files.
12. AI: an assistant answers first from the application's data, never changes data, hands over to a person for money, exceptions and complaints. "Ask GSP" on every agency screen.
13. Notifications: in-app bell and "Needs you"; WhatsApp in India, Bangladesh, Nepal, Sri Lanka and Vietnam; only to the person who must act; quiet hours and digest.

## 5. What today's portal gets wrong (design against these)

- No screen says who acts next or what's missing; the data exists ("RP To Do", "GSP To Do", "Awaiting RP") but is hidden in a dashboard.
- About 80 interactions and 27 required fields to start one application; a separate enrolment step; date of birth can't be typed.
- Territory restrictions appear only after the student and enrolment exist.
- Course search: 17 inputs, no typo tolerance, no data freshness, eligibility as free text.
- Documents: no checklist, internal categories, no expiry, stored at enrolment or application level inconsistently.
- New applications can't be found in lists; totals disagree (260 / 262 / 271).
- Commission: no amount in lists, unexplained terms, no invoice, 70% with no base rate.
- Agencies see internal content (staff notes, error cases, test data).
- No branch view for agency heads; no export; inconsistent labels and layouts.
- Worth keeping: the stage tracker, status tabs with counts, a guided wizard, plain territory warnings with time cost, RP vs GSP to-do split, watchers, the student QR self-registration, CQUniversity's staged document checklist (Pre-Lodgement / Pre-Payment / Pre-Offer / Pre-CoE).

## 6. What competitors do well (learn from these)

From the ApplyBoard audit and the field report (Crizac, KC Overseas, Leverage):
- ~25 interactions and 8 required fields from a new student to a created application: 6 fields to create a student, 2 to start an application, the rest deferred, autofilled from documents, or filled by the student.
- Eligibility inside the application with the exact blocking reason and a fix link; guest eligibility with one required field.
- The requirement checklist is the to-do list: Pending / Approved / Rejected / In Review, one-click Upload, "Optional now, required later".
- A next-action banner on the application; submission proof with timestamps.
- Commission visible at decision time (sort by commission, a hide-commission switch for screen-sharing, tier formula).
- Crizac: 6-question application, named case team with phones, university emails inside the application, 24-hour offers. KC: Eligible / Non-eligible split, upload once. Leverage: turnaround clock on every application, claim and wallet.
- Avoid ApplyBoard's weaknesses: due dates that never exist, contradicting signals, no named owner, unexplained count circles, marketing interrupting work, no export.

## 7. Vocabulary

Use: application, student, course, university, intake, documents, offer (conditional / unconditional), deposit, CoE / CAS / I-20 / LOA, visa, enrolled, census date, commission, statement, tier, GSP contact, BDM, Needs you, With GSP, With university, entry requirements.
Avoid on agency screens: enrolment (as a separate object), case, assessment criteria, SRP, Agency Charge, Is Exported, Write Off, internal IDs like "cid-mm-01-…".

## 8. Scale and constraints

- 84,092 students, 155,235 applications, 6,166 agencies, 1,013 institutions in staging; lists must stay fast and dense.
- Desktop first for staff; agency counsellors also on phones (design mobile for Home, application detail, uploads, chat).
- Brand: upGrad. Use the `upgrad-design-system` skill for tokens, type and components where it applies; the PM prototype's visual style is a placeholder.
- Accessibility: WCAG AA contrast (4.5:1 body, 3:1 large), never colour alone for status (pair owner colour with words), keyboard and screen-reader friendly.
