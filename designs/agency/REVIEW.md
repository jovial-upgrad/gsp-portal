# Review changes, by page

From the GSP OS progress review on **27 Oct 2026**: Deepesh (CPTO), Jovial (PM), Rishi (engineering), Nesil (design). Built from the meeting summary and decisions; the full transcript wasn't available on the shared link.

**Deadlines:** the end-to-end admissions flow by **Wed 28 Oct**; all designs closed by **Thu 29 Oct**, with a one-hour review every day until then.

How this list works: before changing a page, check its section here. When an item is done, tick it and add the date and commit, like `- [x] … (28 Oct, abc1234)`. Open questions stay open until someone answers them; write the answer next to the question.

## 3 Nov, morning: Admin, course search, university and student form (Jovial, in chat)

Prototype only (branch `admin-polish-3nov`); the PRDs follow.

### GSP · Admin
- [x] **User roles › Sales regions:** no Working calendar column or field. A region's calendar is set only on Admin › Work › Working days; editing or renaming a region keeps it on its calendar. (3 Nov, 8ae8d97)
- [x] **User roles › Create roles:** 20 rows a page, with Rows per page (10, 20, 50, 100), the page numbers and Previous/Next. The same pager is on Logs. (3 Nov, 8ae8d97)
- [x] **User roles › Shared mailboxes:** the people on a mailbox, A to Z, paged the same way. (3 Nov, 8ae8d97)
- [x] **Course configuration:** the read-only Intake timings table is gone. The late, closing-soon and countdown days stay decided values in code (S1C-11). (3 Nov, 8ae8d97)

### Find courses / Course page
- [x] No "Doesn’t meet entry yet? <university> is a pathway provider." on the Entry requirements tab. Pathway provider stays a field on the university's Overview. (3 Nov, 8ae8d97)
- [x] **CSV for internal use asks which columns:** the 13 comparison fields as checkboxes (all ticked to start; Select all / Clear all), and the preview and the file have only the ticked ones. This changes the slice 3 PRD's "the CSV has the same fields". (3 Nov, 06ef93d)

### GSP · Institution: university › Submission and contacts
- [x] **Portal logins sit inside How applications are sent**, under the channel, for Own portal (“Portal logins”) and StudyLink (“StudyLink logins”); none for Email. (3 Nov, 8ae8d97)

### RP portal: Profile (RP Admin)
- [x] **RP Admin sees the business documents it uploaded**, from its RP record (the list GSP · RP Ops sees), each with its state and Download. Before, the card showed only while registering in the same session. (3 Nov, 8ae8d97)
- [x] **Profile in four tabs** (one level): Profile (the agency's registered details and You), Documents (business documents and the agreement; RP Admin), Branches and team (RP Admin, Branch Admin), Email preferences. (3 Nov, 5c19887)
- [x] **Every detail the RP registered with** shows on Profile from its RP record: partner code, head office (city, state, country), contact person, owner, commission statements email, how it found GSP, referred by, partner since, its Recruitment contact. GSP's RP record shows the state, owner and commission statements email too. (3 Nov, 5c19887)

### Application page (GSP)
- [x] **Request documents from the RP:** one column (documents, Add another document, What's needed, Due, Send), not the broken two-column grid. (3 Nov, 3fcd4b7)
- [x] **Key details › Sales region:** the region name only, without "routed by rule …" or the queue. (3 Nov, 3fcd4b7)
- [x] **No GSP Assist offer from the mail:** the banner “we’ve received the … offer letter … Should I add it to Documents?” (offer letters, acceptance letter, visa grant read from a mail's attachments) is gone, with its code. GSP uploads these with the status change. (3 Nov, COMMIT)
- [x] **Document request in the chat:** the card sits on its own, without the dark bubble around it, and Withdraw request lines up under the text. (3 Nov, COMMIT)

### Add a student (every role)
- [x] No hint under Email (“Used on university applications. GSP never sends students marketing.”) or Current country of residence (“Where the student lives now.”). (3 Nov, 8ae8d97)

## 3 Nov, overnight alignment with the PRDs (Jovial's brief)

The four engineering-ready PRDs (slices 1 to 4) and the *Final questions S1-S3* proposals, built on branch `overnight-align`, prototype only (README "Overnight alignment with the PRDs").

### Everywhere
- [x] **Nothing hard-coded:** no seeded task, record, log line or future exchange rate; every task from a rule (`work/recordRules.ts`); option lists moved to data modules; `npm run test:derived` and `npm run scan:hardcoded`. (3 Nov, commits “Every task from a rule…” and “Tests: test:derived…”)
- [x] Dates, times and greetings in IST (NFR-1); a record outside the person's regions opens as Not found (BR-19); region-isolation copy says only Admin sees every region. (3 Nov, commits “Copy: …” and “Commission tab from the matrix…”)

### GSP · Admin
- [x] Routing tags "Recruitment contact:", Recruitment assignment's Last changed names who saved, Admin Home's job row opens Work › Emails and daily jobs; RP and branch regions from the regions' Countries (S1F-2); deactivating revokes the login link. (3 Nov, commits “Copy: …” and “S1F-2: …”)
- [x] Daily jobs run on the prototype clock, with their runs log and Prototype: simulate (job failure, bounces). (3 Nov, commit “Every task from a rule…”)

### Application page
- [x] From a shared mailbox, subject "<GSP ID> · <university reference>" (S3F-1); one reference rule; Offer, Accept by, Deposit hidden while empty (S3F-2); no "Keep it" on a flagged upload (BR-50); Commission tab from the matrix (X-1). (3 Nov, commits “Clarity check…”, “Slice 3: …”, “Commission tab from the matrix…”)

### Find courses
- [x] GSP people start with no Student's country (S3F-3); destinations from live universities (S3F-4). (3 Nov, commit “Slice 3: …”)

### Recruitment partners
- [x] "Recruitment contact saved." and "Recruitment contact:" on the closed-account page; Log the first call closes W23. (3 Nov)

## 2 Nov, lock answers: slices 1 and 2 (Jovial)

Jovial's answers in the *Lock S1-S3* tab of his Pending Questions sheet, rows L-5, S1C-1 to S1C-14 and S2C-1 to S2C-19 ("aligned with proposed" builds the proposal). Built on branch `lock-s1s2`, prototype only (README "Lock answers, slices 1 and 2"). Slice 3's rows are built on `lock-s3`.

### Everywhere
- [x] Task rules: **T43** (next year's fees) and **T59** (notice follow-up) removed; **T69** (agreement not signed: RP Admin reminded in the bell and by email E22 after 3 and 7 working days, RP Ops task after 10, L-5) and **T70** (IP Ops: activate each university of a reopened partner, S2C-19) added; **T62** worked out from the students (S1C-13). `npm run test:lock-rules`. (2 Nov, commit “Lock answers S1–S2: …”)
  - Merged with `lock-s3` (2 Nov): slice 3's "Tell <university> that <student> withdrew" (S3C-9), also built as T69, is **T71**; T69 stays the agreement reminders and T70 the reopened partner's universities. `test:lock-rules` checks every rule id is used once. (2 Nov, commit “Lock merge: …”)

### GSP · Admin
- [x] GSP users: any valid email (S1C-2); no Area, the Sales regions column only, no "Covers …" (S1C-3). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Logs: the download log only; settings pages keep their Change history (S1C-9). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Sign-in security and Intake timings: decided values, read only, from `SECURITY` and `INTAKE_TIMES` (S1C-11). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Currency exchange: Fetch with AI only (S1C-10). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Sales regions: non-EU Europe in Latin America & Europe; Caribbean Rest of world; North Africa Africa (S1C-6); the nationality map follows (S1C-13). (2 Nov, commit “Lock answers S1–S2: …”)
  - Chosen in the build, for Jovial to confirm: Russia and Turkey are left in Rest of world (not added to Latin America & Europe).
- [x] admin.gsp@ is the Admin queue's (S1C-14). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Program levels and study areas: add, retire, restore; a level's required Application form level (S2C-13). (2 Nov, commit “Lock answers S1–S2: …”)
  - Since the merge (2 Nov): Find courses' Program Level and Study Area, Add an application's level and area filters, and the application's postgraduate check and document rules read Admin's lists too (an added level counts as its Application form level). Course minimums pick from the Highest education list. (2 Nov, commit “Lock merge: …”)
- [x] Re-routing to another Admissions queue picks a new officer (Fewest open); open tasks follow; logged (S1C-7). (2 Nov, commit “Lock answers S1–S2: …”)
- Already built as proposed, checked: S1C-1 (access levels), S1C-4 and S1C-5 (sign-in copy; the suspended RP's message says "Recruitment contact", as BDM was renamed on 2 Nov), S1C-12 (delete rules).

### GSP · Institution: universities, courses, partners, announcements
- [x] Search priority: a whole number 1 to 10, 5 by default (S2C-1). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Update QS rankings on Universities: template of every university, upload (portal drop zone), updated / unchanged / skipped with reasons; only QS rows; unranked "—", sorted last (S2C-17). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Course Academic: Minimum highest education with its minimum score and grading scale required (to save and to publish), optional backlogs allowed (`minEducation`, `minScore`, `minScoreScale`, `minBacklogs`); CSV columns too (S2C-3). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] No fee year (S2C-6). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] End partnership: a confirmation, no reason (S2C-8). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Reopening a Closed partner changes no university; IP Ops gets T70 for each; an Ended university under it can be activated (S2C-19). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Announcements: Scheduled and Live editable, each save in the Change log; only "N sent" (S2C-15); live just after midnight IST, through the expiry date (S2C-18). (2 Nov, commit “Lock answers S1–S2: …”)
- Already built as proposed, checked: S2C-2 (Go live's fifth check), S2C-4 (Source), S2C-5 (currency list, first-year fee), S2C-7 (Remove an IP document), S2C-11.

### Recruitment partners and the RP portal
- [x] No Issue a notice (S2C-12); Finance, RP Ops and Admin all edit the RP agreement (S2C-10). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] RP team: a Branch Admin sees their branch, invites and deactivates its Counsellors; a Counsellor has no team (S2C-14). (2 Nov, commit “Lock answers S1–S2: …”)
- [x] Sign-up code rules in one place (`SIGNUP_CODE`); unverified sign-ups deleted after 30 days by job J10 (S2C-16). (2 Nov, commit “Lock answers S1–S2: …”)
- Already built as proposed, checked: S2C-9 (Reject, Suspend, Reactivate by status).

## 2 Nov, lock answers (Jovial, slice 3)

Jovial's answers in the *Lock S1-S3* tab of his Pending Questions sheet: L-1 to L-4, L-6 and S3C-1 to S3C-22 ("aligned with proposed" builds the proposal; otherwise his answer). Prototype only, on branch `lock-s3` (README "2 Nov, lock answers for slice 3"). Slice 1–2 rows are applied separately (branch `lock-s1s2`).

### Everywhere
- [x] **Commission figures for RP Admin only** (S3C-7): Branch Admin and Counsellor see no Base commission on course cards or the course page, no Student view switch, no Commission tab, no Base commission in Key details and no commission lines in Activity (`data/rproles.ts` `seesCommission`). (2 Nov, commit “Lock answers S3: …”)
- [x] **One ordered Highest education list, editable by Admin** (S3C-1: "should be editable"): Grade 10, Grade 12, Diploma, Bachelor’s (3 years), Bachelor’s (4 years), Master’s, Doctorate, for students and courses alike; its order is the level check. (2 Nov, commit “Lock answers S3: …”)

### Find courses: search and results
- [x] GSP roles pick from **their own regions' students, each with its RP** (S3C-6). (2 Nov, commit “Lock answers S3: …”)
- [x] As built, confirmed: tags are AND (S3C-4); fees, sorts and Compare in the destination's currency (S3C-5); search as built, semantic later (S3C-20). (2 Nov, commit “Lock answers S3: …”)

### Course page
- [x] **Costs:** the first-year headline keeps the one-time costs, labelled "one-time" (L-4). (2 Nov, commit “Lock answers S3: …”)
- [x] **Eligibility, Academics:** only the highest qualification against the course's Minimum highest education and its minimum score; backlogs only when the course states a limit (S3C-2 with S2C-3). Rows stay grouped (Highest education, Score, Backlogs). (2 Nov, commit “Lock answers S3: …”)
  - Field names: `minEducation`; the minimum score is the course's `minScore` / `minScoreScale` (and `minBacklogs`) when the slice 1–2 course form adds them, else its Academic row for the student's country, else for every country (`data/eligibility.ts` `minScoreOf`).
    - Since the merge with `lock-s1s2` (2 Nov): every course has `minEducation`, `minScore` and `minScoreScale` (required to save and publish, S2C-3; seeded on every sample course), so eligibility and Compare read only the course's minimum; the Academic-row fallback is gone. (2 Nov, commit “Lock merge: …”)
- [x] As built, confirmed: TOEFL sections ×4 (S3C-3); Compare's Scholarship Yes rule (S3C-12); grade conversion edge cases (S3C-18). (2 Nov, commit “Lock answers S3: …”)

### Add a student and the student record
- [x] Highest education from the one list, on Add a student and on the record's Academics (S3C-1). (2 Nov, commit “Lock answers S3: …”)
- [x] **Profile completeness counts only required fields**, no documents (S3C-17). (2 Nov, commit “Lock answers S3: …”)
- [x] As built, confirmed: Share with student hidden (S3C-10); the student fields (S3C-16). (2 Nov, commit “Lock answers S3: …”)

### Applications list
- [x] **New** counts the New stage only (L-2). 25 a page with numbered pages and the sorts, Students and Applications (S3C-14). (2 Nov, commit “Lock answers S3: …”)

### Application page
- [x] **Additional documents requested** (On RP while a request is open) and **Verifying additional documents** (On GSP) are back after Submitted to university, with task rules T7 and T52; Additional documents submitted to university stays removed (L-1). (2 Nov, commit “Lock answers S3: …”)
- [x] **Activity (RP):** status changes show too (L-3). (2 Nov, commit “Lock answers S3: …”)
- [x] GSP can close at any stage, New included (L-6, as built). (2 Nov, commit “Lock answers S3: …”)
- [x] **Assigned officer › Change** for the queue's leader, Admin and Global Ops only; open tasks move; logged (S3C-8). (2 Nov, commit “Lock answers S3: …”)
- [x] **Closing or withdrawing from Submitted to university onwards** gives the officer task T71 "Tell <university> that <student> withdrew", 9 working hours (S3C-9). (2 Nov, commit “Lock answers S3: …”)
- [x] **After enrolment** only Final tuition fee and Census date stay editable, each logged old → new (S3C-11). (2 Nov, commit “Lock answers S3: …”)
- [x] **Census date** pre-filled from the intake when it's set, else empty (S3C-13). (2 Nov, commit “Lock answers S3: …”)
- [x] **Wrong university reference:** fixing it moves the mail conversations matched on it (S3C-19). (2 Nov, commit “Lock answers S3: …”)
- [x] Student, course and intake fixed after Start; a later intake is close as Deferred and re-apply (S3C-22, confirmed; T19's "intake moved" wording removed). (2 Nov, commit “Lock answers S3: …”)
- [x] As built, confirmed: the automatic chat lines (S3C-15). (2 Nov, commit “Lock answers S3: …”)

### GSP · Admin
- [x] Course configuration › **Highest education** (S3C-1): Edit, then Save; add, rename, move up or down, retire, restore; each level names the profile section it fills; Change history. (2 Nov, commit “Lock answers S3: …”)
- [x] Application configuration › **Reasons** (S3C-21): Close reasons by stage and Withdraw reasons, up to 60 characters, unique per list; removing stops it being offered, applications keep theirs; Change history. Send-back reasons fixed. (2 Nov, commit “Lock answers S3: …”)

## 2 Nov, evening: the RP agreement (Jovial)

Jovial: "RP Agreement should be uploaded by BAP, and should go to RP to be signed and reuploaded, that is when we can unlock or approve the RP to unlock all modules for him. Do it in a way, we can upload a new contract in the future also." Later (19:25): signing and uploading is the only way an RP acknowledges an agreement; no "Accept in portal". Built on branch `rp-agreement`, prototype only (README "Design decisions: the RP agreement").

### Everywhere
- [x] **One set of RP statuses and agreement labels**, from `src/institution/data/agreements.ts` and `records.ts`: Not activated → Verifying → Documents sent back → **Agreement sent** (was Activated) → **Agreement signed** (approved, every module open); agreement versions Draft, Sent, Signed copy uploaded, Accepted (active), Sent back, Superseded, Withdrawn. Same words on the RP list, the RP record, RP Home, BAP's Home, My work, the bell and the emails. (2 Nov, commit “RP agreement: …”)
- [x] **Commission held** only while an RP has no active agreement; a new version waiting holds nothing (Finance's engine reads the active agreement). (2 Nov, commit “RP agreement: …”)

### Recruitment partners: an RP's record (GSP · RP Ops, GSP · Admin)
- [x] RP Ops uploads the agreement (PDF, version, optional effective date, notes) and **sends** it, or saves a draft; one open at a time; **Withdraw** before it's accepted; **Send new agreement** any time after approval, the current one staying active until the new one is accepted. (2 Nov, commit “RP agreement: …”)
- [x] **Approve partner** is disabled, with a tooltip, until a signed copy is in; accepting the first signed copy is the approval. Accept or **Send back** with a reason. (2 Nov, commit “RP agreement: …”)
- [x] Documents › RP agreement shows every version (status, sent, signed copy, decision, effective from); Activity logs every step with who and when, worked out from the versions. (2 Nov, commit “RP agreement: …”)

### GSP · RP Ops Home and My work
- [x] Tiles To verify, **Agreement to send**, **Signed copy to review**, Sent back, Not activated, in RP Ops' own sales regions. Tasks RPA (signed copy to check) and T58 (train the RP) are worked out from the RP records by the task rules and close themselves; My work opens the RP's record. (2 Nov, commit “RP agreement: …”)

### RP portal: Home and Profile (RP Admin)
- [x] **The agreement card, redesigned** (Jovial: "not the best UI"): status chip, title and one line; the agreement as a document row with Download; Download · Sign · Upload; one drop zone and a compact **Signed on**; **Send signed copy** at the bottom right; then "Signed copy sent · we're reviewing it" with Replace; sent back shows the reason; the held-commission or "current agreement stays active" note small and muted. (2 Nov, commit “RP agreement: …”)
- [x] Modules (Applications, Students, Earnings, Profile, Select student) open only when the signed agreement is accepted. **Profile › Agreement** (RP Admin only): the active agreement, the one to sign, the history. The bell: an agreement to sign, sent back, accepted, withdrawn; emails E8, E9, E10. (2 Nov, commit “RP agreement: …”)
- [x] ~~Open question: no task rule reminds anyone when an RP hasn't signed.~~ Answered by Jovial (L-5): T69, see "2 Nov, lock answers" above. (2 Nov, commit “Lock answers S1–S2: …”)

## 2 Nov dev briefs (Jovial)

Jovial's decisions of 2 Nov and the day's dev briefs, by page, built in every role that shows the page. Not changed, as Jovial asked: mail compose, and commission visibility beyond Key details. Answered by Jovial the same evening and built: the acknowledgement's wording, Pending with agent, Deposit refund pending, sales region access, Recruitment for BDM; item 14 (disable More after enrolment) cancelled.

### Everywhere
- [x] "BDM" reads **Recruitment** everywhere (Recruitment assignment, Default recruitment contact, the RP's Recruitment and Admissions contacts). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] **Sales region access:** only Admin sees every region by default; every other GSP role sees the regions set on the person; Admin can give Global. Seeded people who had Global now have real regions. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] The portal's tooltip stays on a menu item the pointer has focused (the disabled Withdraw's reason). (2 Nov, commit “2 Nov dev briefs: …”)

### Student record
- [x] Only the top **Add application** button; no Find courses button; no Add application in the Applications part. (2 Nov, commit “2 Nov dev briefs: …”)

### Applications list
- [x] Status chips All, New, Offer received, Enrolled, Closed with counts, greyed out at 0 (`data/listChips.ts`). (2 Nov, commit “2 Nov dev briefs: …”)
  - Chosen in the build, for Jovial to confirm: **New** counts the New stage (Waiting for documents), not Pre-screening.
    - Answered, 2 Nov (lock answers, L-2): yes, New stage only.
- [x] Search by application number or student name only (no passport). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] No "Showing your sales region" line. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] GSP: All RPs multi-select, paged (20 at a time); Advanced filters: Applied date between and Stage, each with its own Clear; Clear all clears everything. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] RP side: "Pending with agent" for what's on the RP (was Pending on you). (2 Nov, commit “2 Nov dev briefs: …”)

### Application page
- [x] Request a document: several at once, each from Admin's Request categories or Other (typed); each its own item in Documents. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Acknowledgement when the RP uploads a requested document: "Thanks for uploading <document>. We’re reviewing it and will update you here." (template in `data/chat.ts`). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Chat rights: RP text only, uploads only against a request; attach, Request a document and Request conditions (every stage) GSP only. (Already so; recorded in `data/chat.ts`.) (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Key details in three groups, Application details, GSP details, RP details (GSP adds the RP and its branch); sections, not tabs; empty fields hidden. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] No Base commission in GSP's Key details; the RP keeps its own. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] University reference: Admissions edit it at any time from Key details, with a confirmation; logged in Activity. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Application stage: Submitted to university is the only status after submission (Additional documents requested, Verifying additional documents and Additional documents submitted to university removed, with tasks T7, T52, T53). (2 Nov, commit “2 Nov dev briefs: …”)
  - Read as written ("the only status after submission"); Document re-upload pending stays, as rejecting a document sets it.
  - Answered, 2 Nov (lock answers, L-1): Additional documents requested and Verifying additional documents come back, with T7 and T52; the third stays removed. (2 Nov, commit “Lock answers S3: …”)
- [x] Change status: no helper text (the conditional offer note and the others). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] No automatic document request on any status change (the visa lodgement proof and payment proof included); GSP's own mandatory uploads stay. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] RP Withdraw up to Ready to submit; after submission greyed out with "Submitted to the university. Ask your GSP contact in chat to withdraw." GSP can close at any stage. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Verification: Background/finance documents upload pending (On RP while a request is open). University assessment or interview is On university. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Deposit refund pending in Acceptance and in Visa (On university; doesn't close the application). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Visa rejected (was Visa refused) closes the application; Visa granted is one status and asks for the course start date. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] After Student enrolled, More shows only Student profile (item 14's "disable More" was cancelled by Jovial). (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Acceptance letter received: Change status no longer stays off when the acceptance letter is already in Documents (filed from Mail); uploading it in the popup turns it on. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Activity: the RP sees only chat, documents and commission lines; mail, submission and status lines are GSP's (`data/activity.ts`). (2 Nov, commit “2 Nov dev briefs: …”)
  - Chosen in the build, for Jovial to confirm: status moves count as GSP-only (the RP sees the status in the header).
    - Answered, 2 Nov (lock answers, L-3): the RP sees status changes too. (2 Nov, commit “Lock answers S3: …”)
- [x] Submission: logins only for Own portal and StudyLink (StudyLink one per sales region); "username and password"; email shows the address only; "Through university portal" is a chip. (2 Nov, commit “2 Nov dev briefs: …”)

### GSP · Admin
- [x] Create roles: phone required; email read-only after creation; Title optional free text; one role, changeable. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Sales regions: countries already in another region aren't offered; Working calendar optional; Working days takes any set of days (Sunday to Thursday); no stray "Last changed" on the nationality map. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Shared mailboxes: access per person, View or View and send; a note and a sync-from date per mailbox; no queues. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Recruitment assignment: one per state or city (duplicate refused with a warning); All / Rest of the country is the fallback, a city overrides it; with no row, the region's default recruitment contact; only Recruitment users. (2 Nov, commit “2 Nov dev briefs: …”)
- [x] Document configuration: **Request categories**, editable; Other always offered. (2 Nov, commit “2 Nov dev briefs: …”)

## Everywhere

- [ ] **No tabs inside tabs.** Separate sections with dividers and shadows instead. (Decision)
  - Nesil, 28 Oct, knowingly against this Decision: the application page's **Documents** tab has tabs of its own (All, Pending, In review, Approved). Raise it at the next review.
  - Nesil, 28 Oct, also against it: a fifth tab there, **Conditions**, for an offer's conditions (Nesil's choice when asked). Raise it with the rest.
  - Nesil, 28 Oct, also against it, in GSP Team: the same tabs in the application page's **Documents** (All, To review, With RP, Approved, Conditions). Raise it with the rest.
  - Nesil, 29 Oct, also against it (Nesil's choice when asked), in both roles: the **student profile**'s menu has three things, and two have tabs inside: **Personal details** (Personal, Academics, English test, Work experience, Background) and **Applications** (My applications, Shortlisted). Raise it with the rest.
- [ ] **Every word on a page comes from a defined data field.** Remove copy that has no source. Jovial checks every field and every piece of copy; Rishi models the data.
- [ ] **Calmer colours**, starting with the application page.
- [x] Nesil, 28 Oct, in both roles: **"Pending on you"**, not "Pending from you" (27 Oct review); **Program Level** for "Level of study" and **Study Area** for "Area of study" (the 27 Oct review questioned the name), in Find courses, Add an application and the student's education.
- [x] Nesil, 30 Oct, in RP Admin and GSP Team: **Notifications** (System, Chat, Mail) and **Announcements** (updates from universities: Intakes, Courses, Scholarships, Entry) at the top right of every page, each with an unread count and a panel. (30 Oct, commit “Notifications and Announcements at the top right”)
- [x] Nesil, 30 Oct (later), in every role: the bell and megaphone on **liquid glass like the navigation**, and **they stay put while the page scrolls**; the panels are glass too. **Real notifications while connected**: the other role's chat messages, status changes, requests and uploads land in the bell, with the bottom-left notification and Open. Announcements now use the Institution Team's model and categories (PM data), live ones only. (30 Oct, commit “Glass, sticky bell and megaphone; real notifications while connected; GSP · Institution brought up to date”)
- [x] Nesil, 30 Oct (later still), in every role: the bell and megaphone are **two separate glass circles**, and **the page no longer scrolls behind them**: on wide screens they sit in a strip at the top that never moves, and the page scrolls in its own area under it, fading out at its edge (as in upGrad's learner home). Phones keep the glass top bar. (30 Oct, commit “Bell and megaphone in their own circles; the page scrolls under the strip, not behind it”)
- [x] Jovial, 2 Nov: **no system UI**. Every dropdown, date, time, number, upload, tick box, radio, tooltip and prompt is the portal's own, from the design system, in both themes: selects are SelectMenu (a search box over lists of more than ten), dates the portal's calendar (DatePicker), times TimePicker, numbers NumberField (optional − / +, min and max), uploads FileDrop or the portal's own drop zones, tick boxes and radios drawn by the portal, `title` tooltips the portal's tooltip, the link prompt a dialog, and "Change history" sections the portal's chevron. (2 Nov, prd-merge, commit “No system UI: portal-native selects, dates, times, numbers, uploads, ticks, tooltips”)
- [ ] **Two views: counsellor and admin.** Counsellors see only their own students and applications; admins see everything and rarely counsel. Add a role switch to the Prototype panel to show both. Review the counsellor view first.
  - Nesil, 27 Oct: a **Role** switch now sits beside Prototype with **RP Admin** (the agency portal so far) and **GSP Team** (a copy of it, to become GSP's internal portal). An RP Counsellor role can be added to it for this item.
  - Nesil, 29 Oct: the agency's roles are now named, on RP Admin's Profile: **RP Admin** (everything), **Branch Admin** (their branch) and **Counsellor** (their own students and applications). Each team member has one, and a branch. The views for Branch Admin and Counsellor aren't built yet.

## Sign in, Become a partner, Check your email, portal Home while registering

- [x] Engineering walkthrough, 1 Nov (Rishi, Prince, Abhay): no hint under Country, no referral code, no WhatsApp (copy now says email); owner contact ticked by default and the commissions email stay. (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

No changes from this review.

## Find courses: search and results

- [x] Jovial, 2 Nov (slice 3 PRD), in every role: five filters only (Tuition fee and Duration as two-handle ranges, Tags, University multi-select, Destination state); four sorts (Recommended by Search priority, Fee high to low, Fee low to high, QS ranking); cards show the total tuition fee with the fee a year, up to two intakes, QS rank or "—"; Compare has the decided fields and tags; GSP's roles use the same page without commission. This replaces the 1 Nov University radio list and the quick filters. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: **Select student** is off until GSP verifies the agency; no **Shortlisted only** filter; results in **pages of 20** (Previous, numbers, Next); the left filters offer only what's in the results, and University is searchable, A to Z, 10 at a time. Open: Best match and Deadline soonest logic, ranking by CSV, search type (sheet, *Walkthrough 1 Nov*). (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

- [x] Add **Intake** to the main search bar, next to Destination (there's room). Today it's only in the side filters. Free text like "nursing in Australia, Feb" fills it in. (27 Oct: sixth part of the bar, optional, "Any" by default; out of the side filters)
- [x] Rename **You earn** to **Base commission**. The Student view still hides it. (27 Oct: on the cards, the sort ("Highest base commission"), the course page, the application page and GSP Assist's answer)
- [ ] …with an **eye icon** whose tooltip lists the other incentives on top of it.
  - Open question: which incentives, and from which data field?
- [x] Result cards look pale: add the **university logo**. (27 Oct: every university's emblem, from its website)
- [x] …and a **bigger country flag**: Deepesh asked for a flag background or flag-colour treatment on the card header. (27 Oct: of five options Nesil picked the flag wash with the country tab: the header washed in the flag's colours, and a tab in its main colour naming the country with its flag)

- [x] Nesil, 27 Oct: an optional **Student** dropdown, first on the search row before a shorter search box; their country and state fill the bar. Existing students only, no "Add a student" here. It always opens; with none yet the list says so. The Find courses review states now open a verified agency with its students.
- [x] Nesil, 27 Oct: cards drop **IELTS**; "Checked 7 Oct" becomes **"Last updated on 7 Oct 26"**, small and grey.
- [x] Nesil, 27 Oct: cards drop the **GSP priority** tag (Best match still ranks priority universities first).
- [x] Nesil, 27 Oct: cards **lift on hover** (and on keyboard focus) with a deeper shadow and an edge in their flag's colour; **firmer borders**: the search card has an edge all round, the bar's edge is darker, and the card header's line runs edge to edge.
- [x] Nesil, 27 Oct (3rd round): the **flag in the country tab** sits on a small white plate; Australia's and New Zealand's navy flags were lost on their navy tabs.
- [x] Nesil, 27 Oct (2nd round): intakes on the cards are **the month only**: no "closes in N days", no "likely" (a closed one still says so); **no "Offer in about N days"**; the **QS world ranking** takes its place. The "Some hidden (Punjab)" review state is gone from the Prototype panel.
- [x] Nesil, 29 Oct (later), in RP Admin and GSP Team: Compare beside the card's star and the dialog's Shortlist; tags and "Last updated" a little lower; **Compare** is the bar's main button; the comparison has lines between the courses and Apply and Shortlist at the foot of each; the download's PDF/CSV pills have room above them; no "Only course and university"; unticked boxes are white. **Every notification comes in the bottom-left corner**, one style (the shortlist nudge, "student added"). (29 Oct, commit “Notifications bottom left; compare beside the star; profile without section lines; Add an application on the profile”)
- [x] Nesil, 29 Oct, in RP Admin and GSP Team: **shortlists are the student's**. With a student picked, the star shortlists for them and a nudge says so, with a link to their profile's Shortlisted tab; the star again takes it off. With none picked, the star lists the agency's students to pick from. **Compare** up to five courses side by side (best of each row marked) and **download** them as the PDF for the student (the full comparison, no commission) or a CSV of the columns picked, as in the PM prototype. (29 Oct, commit “Find courses: shortlist for a student, compare up to five, download PDF or CSV; profile documents only as uploaded”)
- [x] Nesil, 29 Oct, in RP Admin and GSP Team: the card header was too tall. The **country tab** is gone from the top corner; the country, with its flag, is now a **chip at the start of the intakes' row**, edged in the flag's main colour. The flag wash stays (Deepesh's bigger flag), and the header is a row shorter. The course dialog keeps its tab. (29 Oct, commit “Course cards: the country moves beside the intakes; a shorter header”)
  - Nesil, 29 Oct: the flag in the chip has **no white plate** (the box around it); the chip is light, so even the navy flags show. The dialog's tab, in the flag's own colour, keeps the plate. (29 Oct, commit “Course cards: the flag in the country chip without its white box”)
- [x] Nesil, 30 Oct, in RP Admin, GSP Team and GSP · Institution: **no offer time anywhere** in Find courses (Course search): not on the cards (“Offer in about 5 days”, still on GSP Team’s and the Institution Team’s), not in the dialog (its fact strip and “Typical offer time”), and no **Offer within 7 days** filter or **Fastest offer** sort. (30 Oct, commit “30 Oct review: course search trimmed, the RP on GSP’s adds, Institution edits”)
- [x] Jovial, 2 Nov, in every role: **University** in the results' filters is a **multi-select dropdown** (the portal's own MultiPick): the universities in the results, A to Z, with each one's course count, searchable, 10 at a time; the field names the one picked or says “N selected”; Clear empties it. It replaces the checklist. (2 Nov, branch search-polish, commit “Find courses and course page: University dropdown, duration numbers, first-year costs; eligibility grouped”)
- [x] Jovial, 2 Nov, in every role: **Duration** shows just the numbers (<1, 1, 2, 3, 4, 5+) and its label says **Duration (years)** once; no “Courses in credits match every range” line (they still match every range). (2 Nov, branch search-polish, commit “Find courses and course page: University dropdown, duration numbers, first-year costs; eligibility grouped”)


## Course page

- [x] Jovial, 2 Nov (slice 3 PRD): Apply only (no Shortlist in the dialog), days left on intakes, no Top disciplines or Program levels, and the eligibility check with a student picked (Select a student to check their eligibility, without one). (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: no Compare inside the course dialog (Compare stays on the cards; the comparison downloads as PDF and CSV). Open: when the comparison highlights a value. (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

- [x] **Remove "Show only this university in results".** (Decision) (27 Oct, with the redesign below)
- [x] Rename **You earn** to **Base commission**, as on the results. (27 Oct)
- [ ] …with the eye-icon tooltip, as on the results (waits for the incentives question there).
- [ ] Intakes: replace "likely" with each intake's **application deadline**, **batch start date** and **census date**. (27 Oct: in the dialog "likely" is gone and each intake shows its apply-by date and days left; batch start and census dates still need data.)
  - Nesil, 27 Oct (2nd round): the result cards now show **no deadline at all**, only the month ("likely" and "closes in N days" are both gone); the dates live in the dialog. Confirm with the reviewers that cards don't need the deadline.
- [ ] Every word from a defined data field (see Everywhere).

- [x] Nesil, 29 Oct, in RP Admin and GSP Team: **Costs** has no Base commission card (Base commission stays in the fact strip, where the eye-icon item above can go); Fees and Other costs sit side by side, and **Scholarships** takes the full width under them, listing the course's scholarship and the university's own awards. **Tuition a year** in Fees is **Total tuition**. **Eligibility and documents** opens with a **country switcher**: India (by default, or the searched student's country), Bangladesh, Nepal, Sri Lanka, Nigeria, Vietnam and **All countries**; the requirements, English waiver and documents follow the country. (29 Oct, commit “Course dialog: scholarships across Costs, no base commission card; entry by the student's country”)
  - Nesil, 29 Oct (2nd round): the country chips become **one dropdown**: **All countries** first, then six countries with their flags. It starts on the **RP's country** (India for now). Each card says on the right whom it's for ("For students from India"). **All countries** shows every country's entry requirements, English waiver and documents side by side. (29 Oct, commit “Course dialog: one country dropdown, All countries side by side”)
  - Open question: the per-country rules and the university scholarships are sample data. Where do the real ones come from? A data source for Jovial and Rishi.
- [x] Nesil, 28 Oct: in **Documents to collect**, what the course needs only later says GSP asks for it ("GSP asks for them after the offer, for the visa", "…if there’s a gap in study", "…if the university wants them"); the rest is what Add an application collects. (28 Oct, commit “Each application asks for its own documents; later ones come as GSP’s requests”)
- [x] Nesil, 27 Oct (6th round): Campus life photos have **no captions**, and the **"Sample photos"** label is gone.
- [x] Nesil, 27 Oct (5th round): an **expand** button beside Close makes the dialog fill the window and back, as in Add an application.
- [x] Nesil, 27 Oct (4th round): no **Offer in** in the dialog's fact strip. The University tab adds **Campus life** (up to 10 photos in a strip with arrows; for now five sample photos, the same for every university, marked as samples), **Top disciplines** and **Program levels**, from the courses GSP lists for it.
- [x] Nesil, 27 Oct (3rd round): no **tags** in the dialog's header (level, area, group, work placement, pathway); the fact strip leads with **Study mode** (Full time, Part time, Blended or Online) instead of the next intake; **Total tuition** for the whole course instead of tuition a year, with no scholarship line; Overview drops **About the course**, so similar courses take the full width.
- [x] Nesil, 27 Oct: **Details opens a dialog in the middle** of the window, not a side panel (a bottom sheet on phones), and the page is **less pale and easier to read**: the flag header with a fact strip, each part on its own card with an icon and a line, intakes as calendar leaves, the first year's costs as one bar of its parts, English scores as tiles, university facts as tiles.
- [x] Nesil, 27 Oct (2nd round): no **GSP priority** tag in the dialog; intakes show **days left**, not "likely"; the dialog **scrolls as one** with a slim bar (tabs, Shortlist, Apply) that stays at the top; cards in **rows that line up**, the cost legend and the documents in **aligned columns**; entry requirements as tiles: **eligibility**, **highest education %**, **maximum backlogs**.
- [x] Nesil, 30 Oct, in RP Admin, GSP Team and GSP · Institution: the **campus** card has nothing about regional visas (“Regional area for visa purposes” and the line under it); **intakes** show no “days left” (a closed one still says Closed); **Fees** has no deposit to accept the offer (nor a UK CAS deposit); **Documents to collect** lists only the **passport**, the **academic documents** (the school mark sheets, in the student’s country’s own names, and the bachelor’s for a postgraduate course) and the **English test score, optional**, in three equal columns. (30 Oct, commit “30 Oct review: course search trimmed, the RP on GSP’s adds, Institution edits”)
  - Open question: the campus item also asked to remove “In course search: in course cards and details:”, which reads like part of the message itself. Was something else in the campus card meant?
- [x] Jovial, 2 Nov, in every role: **Costs** opens with **one year**: “First year (a year’s costs)”, the total of tuition a year, living costs a year (GSP · Admin › Living costs), visa and health cover for the year (Admin's Visa and health fees) and the one-time application fee, in the bar and its list. A course longer than a year then shows **Whole course** with the same parts for its full length; a course under a year shows its whole length; one in credits a year, as before. (2 Nov, branch search-polish, commit “Find courses and course page: University dropdown, duration numbers, first-year costs; eligibility grouped”)
- [x] Jovial, 2 Nov, in every role: the **Eligibility** tab's check is two groups, **Academics** (Highest education, Score, Backlogs) and **English**, each with its worst check's state and every check under it, as in Add an application. (2 Nov, branch search-polish, commit “Find courses and course page: University dropdown, duration numbers, first-year costs; eligibility grouped”)


## Students list

- [ ] **Only admins see the counsellor pencil.** No acceptance step; an admin's change is logged as theirs. (Decision)
- [x] Counsellors see only their own students. No **All counsellors** filter for a Counsellor (2 Nov). (2 Nov, prd-merge, commit “No system UI: portal-native selects, dates, times, numbers, uploads, ticks, tooltips”)

- [x] Nesil, 27 Oct: the Applications column shows **the number only**, with no "pending" or other status under it.

## Add a student

- [x] Jovial, 2 Nov (slice 3 PRD, S3C-1 proposal): Highest education is the one list, Grade 10 to Doctorate. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: **passport number required**; the duplicate check is by passport number within the RP only (no email or cross-RP check). (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

- [ ] Collect **every mandatory field** here, so the profile never shows a mandatory field as pending.
  - Open question: which fields are mandatory? Today passport number, gender, date of birth, passport expiry, state and city are later listed as "missing".

- [x] Nesil, 29 Oct, in RP Admin and GSP Team: the dialog **expands** to fill the window, as Add an application does. **Documents** at the end, two ways: **Upload all documents now** (the only place to upload in bulk; each file sorted into its folder on the profile, the passport read into the form too) or **Upload one by one, from the profile**. **See list of documents** shows what the profile needs to begin with (passport, the highest education's marksheet or transcript) and everything else worth collecting. (29 Oct, commit “Add a student: expands, and takes every document at once; no bulk upload on the profile”)
- [x] Nesil, 30 Oct, in GSP Team and GSP · Institution, not RP Admin: **Recruitment partner** first in Add a student (required): GSP adds students for a recruitment partner. The list is the ones whose agreement is signed. (30 Oct, commit “30 Oct review: course search trimmed, the RP on GSP’s adds, Institution edits”)

## Student record

- [x] Jovial, 2 Nov (slice 3 PRD): Share with student hidden (S3C-10 proposal); each qualification's grading system comes from Admin › Grade conversion. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: one **Edit** in each section's header; autofill from a document happens **once**, then "Filled in from … Correct any field by hand." Open: profile completeness counts mandatory or optional fields (this page's item above says optional; the walkthrough said mandatory). (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

- [x] **Lead with bulk document upload and auto-reading**, then show what's still missing in each section. (27 Oct, commit “Student record: one page, led by uploading every document”)
  - Nesil, 29 Oct (last round): no lines under the parts of Personal details (Personal, English test, Work experience, Background) or under Where they live; "The highest education is required. Other levels are optional." under the highest education; Documents has no "Needed to apply" and its line sits under the title; My applications cards have the university's logo; **Start application opens Add an application on the profile**. In Add a student: no hint under the highest education, the dialog scrolls to new files, a light line above Choose files. (29 Oct, commit “Notifications bottom left; compare beside the star; profile without section lines; Add an application on the profile”)
  - Nesil, 29 Oct (later): no note on the profile saying where bulk-uploaded documents went; the "added" banner says "Complete the student's profile." and goes after a few seconds; **Documents shows only what's uploaded** (a part with nothing isn't listed), with one **Upload a document** that sorts it into its part. (29 Oct, commit “Find courses: shortlist for a student, compare up to five, download PDF or CSV; profile documents only as uploaded”)
  - Nesil, 29 Oct, reversing the bulk upload part of this agreed item: **no bulk upload on the profile**. It moved to Add a student, the only place to upload in bulk; each section of the profile uploads its own documents. The profile opens with a note saying where the documents uploaded while adding went. Raise it at the next review. (29 Oct, commit “Add a student: expands, and takes every document at once; no bulk upload on the profile”)
- [ ] **Profile completeness counts only non-mandatory fields.**
  - Answered, 2 Nov (lock answers, S3C-17, Jovial): **only required fields** count, no documents. Built (2 Nov, commit “Lock answers S3: …”). This reverses the item as worded; it wasn't marked Decision.
  - Nesil, 27 Oct: built the other way round. Completion counts only the mandatory fields and sections (Personal details and Education, with the passport copy and the highest level’s marksheet or transcript); the optional sections don’t move it. Confirm at the next review.
- [ ] **Education:** allow more than one entry per level (two bachelor's, say), each with its **own country**. Today there's one "Country of education" and one entry per level.
  - 27 Oct: the "Country of education" at the top is gone; each level has its own country. Still one entry per level.
  - Open question: what are levels and grades called in Nepal, Bangladesh and the US?
- [ ] **Work experience:** keep the optional section.
  - 27 Oct: still optional. Uploading the resume reads its jobs in (and keeps it as the CV); Add job sits at the top of the section, like Add education and Add test.
  - Open question: do university portals require it, and which fields?
- [ ] **Only admins see the counsellor pencil.** (Decision)
- [ ] **After a reassignment,** the original creator and past actions keep their names, and new actions go to the new counsellor. Activity shows "Reassigned by {admin}".
- [x] Nesil, 29 Oct, in RP Admin and GSP Team: the profile's menu has **three things**: **Personal details** (tabs: Personal, Academics, English test, Work experience, Background), **Documents** (every document, and only there) and **Applications** (tabs: My applications, and **Shortlisted**, the courses starred for the student in Find courses). The first time, a part of Personal details can be filled in from its document; after that it's edited by hand, with no upload there. Add a student's documents are a **Bulk upload** with "Or upload them individually from the student's profile" under it; clicking it drops out what to include (Passport, ticked when it was uploaded to fill the form; Academics; English test), and the student can be added without it. (29 Oct, commit “Student profile: Personal details, Documents and Applications; bulk upload drops out what to include”)
- [ ] No tabs inside tabs (see Everywhere).
  - Nesil, 29 Oct: the profile now has tabs inside two menu items (see Everywhere).
  - Open question: does this mean the record's section tabs go? Nesil, 27 Oct: first yes (one page), then reversed the same day: the record keeps **one level** of section tabs, with nothing tabbed inside them, which the Decision allows. Confirm at the next review.

## Applications list

- [x] Jovial, 2 Nov (slice 3 PRD, S3C-14 proposal): the PRD's tiles, filters (GSP: destination, recruitment partner, stage, sales region; RP: counsellor, stage, intake) and columns, Started or Applied, Enrolled, Closed or Withdrawn pills, 25 a page. The progress chips and date range are gone. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Counsellors see only their own applications; admins see all. No **All counsellors** filter for a Counsellor (2 Nov). (2 Nov, prd-merge, commit “No system UI: portal-native selects, dates, times, numbers, uploads, ticks, tooltips”)

- [x] Nesil, 27 Oct: **no GSP Assist "Today" brief**; the four tiles are a number and a name only (**All applications, Pending from you, With GSP, With university**); **"Pending from you"** replaces "Needs you" for applications (list, application page, GSP Assist, the student list's application tags).
- [x] Nesil, 27 Oct: **primary filters** by how far an application has got, read from its status and stage: **New, Applied, Offer received, Deposit paid, Enrolled**; then search, destination, counsellor and intake; then **Advanced filters**: a stage, and a start and end date for when applications started.
- [x] Nesil, 27 Oct: the Status column is the status the application is at within its stage; **Download** saves the table as it stands as a CSV.
- [x] Nesil, 27 Oct (2nd round): **no lines under the status** (time at the step, "usually N days", "GSP asked"); the CSV drops them too.

## Add an application

- [x] Jovial, 2 Nov (slice 3 PRD, S3-7, S3-28): an open or Enrolled application for the course blocks; outside the person's regions the message has no ID, status or link; the eligibility check reads the course's Minimum highest education, Grade conversion and English test equivalence. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: one **open** application per student and course (any intake; closed ones don't block); GSP Assist's eligibility check never blocks. (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

- [ ] Intakes: replace "Likely to open" with the deadline, batch start date and census date.
- [x] If commission shows here, call it **Base commission**. (27 Oct: it doesn't show here)

- [x] Nesil, 27 Oct: a **dialog in the middle**; the course list **scrolls inside its box**; GSP Assist **works through each part of the check in turn**, then shows eligibility; **no Update profile** button; the check says what GSP Assist does ("checks Priya's profile against Flinders University's entry criteria").
- [x] Nesil, 27 Oct: **Documents** for now are the **10th, 12th and UG marksheets**, a card each with a drop zone, progress, GSP Assist reading it, what it read or why to look again, Replace and Remove; wrong type or over 10 MB refused.
  - Superseded 28 Oct: each application now asks for its own documents (below).
- [x] Nesil, 27 Oct (3rd round): an **expand** button beside Close makes the dialog **fill the window**, with a margin all round, and back.
- [x] Nesil, 27 Oct (4th round): the dialog was too plain to tell the steps apart: **each step on its own card** on a grey surface, **a rail of step markers** (number, tick when done, navy for the one to do now), the current step lifted, steps that can't start yet as dashed outlines, intakes as calendar tiles, a soft brand light on the header.
- [x] Nesil, 27 Oct (6th round): picking the intake **scrolls to GSP Assist · Eligibility** (so does picking a course, which picks its intake); no **"Profile 28%: 18 to add"** chip under the student.
- [x] Nesil, 27 Oct (5th round): GSP Assist's check isn't a stage, so **no marker on the rail** for it (nor for the backup choice); the chosen course no longer says **"offers in about N days"** (nor the course list's "~N days").
- [x] Nesil, 27 Oct (7th round): once started, the confirmation says **"Waiting for documents."** instead of listing everything still missing.
- [x] Nesil, 27 Oct (2nd round): no **verdict headline** over the eligibility reasons ("Add details to check…"); no **"It waits for N documents"** line; the **actions aren't held in a bar at the bottom**, they come at the end of the form.
- [x] Nesil, 28 Oct, in RP Admin and GSP Team:
  - **Destination** comes first in Course: a dropdown of the countries, which narrows the universities and the courses (from the 27 Oct review: destination, university, level, step by step).
  - **No pills under the student**: GSP Assist's eligibility check already says what it used.
  - **GSP Assist · Eligibility** is slower (about 1.2 s a part) and says what it's doing: "GSP Assist is checking Priya's profile details against Flinders University's requirements for the Master of Data Science, to see if Priya is eligible."
  - **Where they live** names the country only. **Academics** and **English** say what the university asks for and what the student has ("…asks for 63% and Priya has 78%, so Priya is eligible"), or, with no score, "Complete the academic details on Priya's profile to check eligibility" with **Open the profile**. Intake is unchanged.
  - **Documents**: GSP Assist checks each marksheet. Not clear, not the document asked for, or another student's name: **Re-upload** (status Re-upload). Right: "Uploaded successfully", **Replace** (status Uploaded). Only uploaded ones go with the application.
- [x] Nesil, 28 Oct, in RP Admin and GSP Team: **each application asks for its own documents**, since what's needed depends on the university, the course and the student. Documents lists the course's list read for the student: the passport, the marksheets for the course's level and the student's education, the English score report from the profile, the statement of purpose and CV (required for postgraduate courses), and the course's own (work letters for an MBA, a portfolio, a research proposal), required ones first, "2 of 7 required ready". The application keeps that list. What the course needs only later isn't collected here: **GSP asks for it in the chat** when it's needed. The same four outcomes for every document (not clear, not the document asked for, another student's name, uploaded successfully). (28 Oct, commit “Each application asks for its own documents; later ones come as GSP’s requests”)
  - Open question: should anything depend on the destination or the student's nationality (a Genuine Student statement for Australia, for example)? The list has a place for it once GSP gives the rules.
  - Open question: a university that turns down one state (Punjab, for some Australian universities) still names the state in its "doesn't take students from" line, since the country alone would read as the whole country. Keep it, or say it another way?
- [x] Nesil, 30 Oct, in GSP Team and GSP · Institution, not RP Admin: **Recruitment partner** first in Add an application (required); the student list shows that partner's students, and adding a new student starts with it. The application keeps it. (30 Oct, commit “30 Oct review: course search trimmed, the RP on GSP’s adds, Institution edits”)
  - Chosen in the build, for Nesil to confirm: the sample students are all Horizon Overseas', the prototype's own agency; a student or application GSP adds for another partner still shows in RP Admin, which is Horizon's.
- [x] Jovial, 2 Nov, in RP Admin and GSP Team: GSP Assist's check shows **one Academics row** (Highest education, then the score, then Backlogs, each with its own result and why) and **one English row**; each row takes its worst check's state (no, add, warn, na, yes). Where they live and Intake are as they were; the checking steps stay one per group; “Open the profile” still goes to education or tests. (2 Nov, branch search-polish, commit “Find courses and course page: University dropdown, duration numbers, first-year costs; eligibility grouped”)


## Application page

- [x] The header gives **the student and the university equal weight**. Today the course and university lead, and the student sits in the fact strip. (27 Oct)
  - Nesil, 27 Oct: the student now **leads**: their name is the title, with the course and the university (and its logo) on the line under it. Check at the next review that this is the weight the reviewers wanted.
- [ ] **Calmer colours.** The reviewers found the page overwhelming: header gradient, aurora, banners, owner colours.
  - Nesil, 27 Oct: the chat is calm now (a plain card, grey and white bubbles, GSP Assist's mark and name only). The header gradient, the banners and the owner colours are as they were.
- [x] **Summary / Documents / Chat / Activity:** their purpose was unclear. Restructure once Jovial's research on other portals is in, without tabs inside tabs. (27 Oct)
  - Nesil, 27 Oct, ahead of Jovial's research: no Summary. **Chat** (opens first), **Documents**, **Activity**, with Key details and the GSP contact beside every tab. "What you need to do" and Send to GSP moved to the top of Documents; the offer's dates moved into Key details. Revisit when the research is in.
- [x] **Chat** is free text between the RP counsellor and the GSP admissions team. The **document request is the only structured template**, and it also appears in Documents. (Decision) Changed by S3-30: two templates, built. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)
  - Open question: does GSP Assist still answer first in the chat, or work beside it? Jovial is bringing examples of each chat template to refinement.
  - Nesil, 28 Oct: **no GSP Assist in the RP chat** for now: nothing answers on its own; the GSP contact replies. No attach button; the box says "Ask GSP…".
  - Nesil, 28 Oct (3rd round): **GSP Assist's mark and name head the RP chat**, as in GSP Team. Still nothing answers on its own.
  - Nesil, 28 Oct, knowingly against this Decision (Nesil's choice when asked): **an offer's conditions come as a second structured template**, a form of questions and documents GSP sends and the RP answers in the chat or in Documents. Raise it at the next review.
  - Nesil, 28 Oct (3rd round): the conditions form is **questions only** now.
  - Jovial, 2 Nov (slice 3 PRD, S3-30): **Decision changed: the chat has two structured templates**, the document request and the conditions request. This settles Nesil's 28 Oct note above.
  - Nesil, 27 Oct: the suggested questions under the chat are gone.
- [x] ~~**University emails:** an agent or triggers read them and update the status on their own.~~ Replaced by Jovial, 1 Nov: every status after Pre-screening is changed by the officer. Mail reads the email and suggests the status; the officer confirms, and Mail warns when the move would skip a status. (1 Nov, 05249dc)
  - Nesil, 28 Oct (the stage and status concept): for now **GSP's team moves every status by hand** (only New to Pre-screening moves on its own). GSP Assist reads the university's mail for documents (offer letters, the acceptance letter, the visa) and **offers to add them** to Documents and tell the RP; it doesn't change the status. Confirm with the reviewers which way this goes.

- [x] Nesil, 28 Oct, **the 8 stages and their statuses** (Nesil's stage and status concept): New (Waiting for documents), Pre-screening (Pending verification, Documents rejected), Application (Ready to submit, Submitted to university, Additional documents requested, Verifying additional documents, Additional documents submitted to university), Offer (Conditional offer received, conditions pending; Conditions submitted to university), Verification (Finance and background check, University assessment or interview, Unconditional offer letter received), Acceptance (Tuition or deposit pending, Payment proof under review, Awaiting acceptance letter from university), Visa (Visa lodgement pending, Visa decision pending, Visa granted: waiting for start date), Enrolment (Enrolment confirmation pending, Student enrolled). Each stage's ways to close: Not eligible, Student withdrawn, University rejected, Offer declined, Refused after assessment, Rejected by university, Visa refused, Deferred. **Only New to Pre-screening moves on its own**; the RP's uploads go to GSP but don't move the status, and the tag says GSP once everything asked for is in. The university has the statuses where it's deciding (Nesil's choice when asked); the rest follow the concept. **Conditions** come as GSP's form, answered from the chat or Documents' new Conditions tab; Documents shows **From GSP**; **every document can be previewed and downloaded**; **Student enrolled** shows a tick and party poppers (none for less motion). (28 Oct, commit “The 8 stages and their statuses, moved by GSP; conditions form, mail nudge, preview and download”)
  - Open question: the concept has Awaiting acceptance letter and Enrolment confirmation On GSP, so With university now only counts applications the university is deciding on. Confirm the With university tile still earns its place.
- [x] Nesil, 28 Oct (3rd round), both roles: **Document re-upload pending** is a status in every stage but New, and it's the RP's; at Pre-screening it replaces Documents rejected. **Additional documents submitted to university** is gone. **Who has it**, in every stage: a document GSP asked for puts it with the RP; one the RP uploaded and sent that GSP hasn't checked puts it with GSP. In RP Admin, Documents' **Conditions** are GSP Team's cards, a set counting as one (the card opens the form to answer, or the answers once sent), and numbers sit in the middle of their circles. (28 Oct, commit “Document re-upload pending in every stage; status dropdowns, nudge per status, review steps”)
  - Open question: when GSP has asked for a document and also has the RP's uploads to check, the tag says the RP (the request comes first). Confirm that's the order the reviewers want.
- [x] Nesil, 28 Oct: Documents shows **only what's pending on the agency to upload** (or answer): no "Add to Mohammed's profile" rows for an English test or education details, in the list, the banner or "To send". A missing English score report is a document to upload; details missing from the profile are for the profile, as the eligibility check in Add an application says. (28 Oct, commit “Documents: only uploads pending on the agency; GSP verifies every document of a new application”)
- [x] Nesil, 28 Oct: **GSP verifies every document of a new application**, those taken from the student's profile too: they're the application's own, "from Priya's profile", In review until GSP accepts them; GSP Team lists them in To review ("from Rohan's profile, for this application"). (28 Oct, commit “Documents: only uploads pending on the agency; GSP verifies every document of a new application”)
- [x] Nesil, 28 Oct: **Documents lists what the application asked for when it was added**, then what GSP requested since; the statement of purpose and CV show too, so the RP sees them approved. **Anything needed later is GSP's request in the chat**: the sample offer's two conditions and the visa lodgement proof now come that way. A request goes to GSP as soon as it's uploaded; the last one owed at the agency's step moves the application on (the conditions to "Sent to university", the visa proof to "Visa submitted"), so there's no Send to GSP for them. A request made for a step closes when the application moves on ("No longer needed" on its card, as when GSP is asked to lodge the visa). Each request card shows the file that answered it. (28 Oct, commit “Each application asks for its own documents; later ones come as GSP’s requests”)
- [x] Nesil, 28 Oct (RP Admin, 2nd round): Documents has **no "What you need to do" card**: what's pending on the agency comes **first in the Documents card**, highlighted, in All and Pending, with Send to GSP under it; no **"GSP asked"** tag, no "Meera Pillai, 28 Oct, in the chat" line; due dates with the year (**"Due 31 Oct 26"**). The banner above the tabs stays, as **"Pending on you"**, without "(GSP asked)". **"Pending from you" is now "Pending on you"** across RP Admin (header tag, banner, Applications tiles and filters, the student list's application tags).
- [x] Nesil, 28 Oct (RP Admin): **Your GSP contact** first and smaller, with no "Message in the chat" button, then **Key details** (Length becomes **Duration**; no Campus). The header drops the **ID line** above the student's name and is a little shorter. **Documents** lists only the marksheets Add an application asks for and what GSP requested, in tabs **All, Pending (to upload or rejected), In review, Approved**; no "Upload once, use everywhere" line.
- [x] Nesil, 27 Oct: the header has a **border all round** (its corners faded out); the title is **the student's name**, then **course and university**, then **campus and country**; the **fact strip is gone** (counsellor and base commission moved into Key details).
- [x] Nesil, 27 Oct: **the status in the header's right corner, with one tag** for who has it: GSP, Pending from you or University, never two. Anything on the agency, a document GSP asked for included, makes it Pending from you. The stage path says "Now" under the current stage instead of repeating who.
- [x] Nesil, 27 Oct: **no suggested questions** under the chat; **GSP Assist's colours toned down** in the chat (no aurora, glass or gradient words).
- [x] Nesil, 27 Oct (2nd round): the chat **lines up** with Key details and the GSP contact (same top, same bottom); the chat has a **very light tint**; a **light line** between the header's details and the stages; the ⋯ button says **More**; the request is the **Gap explanation document** (also in the course's document list).
- [x] Nesil, 27 Oct (4th round): the GSP contact no longer names the regions ("Australia and New Zealand"), just **GSP admissions**, and shows an **email** with the phone, each to copy.
- [x] Nesil, 27 Oct (3rd round): a **liquid-glass frame** round the chat (the messages stay on a solid panel); **space and a light upright line** between the status and More.

## GSP Team

- [x] Jovial, 2 Nov (slice 3 PRD), the application page in GSP · Admissions (and the Institution Team and Admin, which now use the same pages): Who has it from what's open; Change status without Waiting for documents or re-upload pending, off until what the status needs is done (reference or No reference ID, the GSP upload, who lodges the visa), close reasons by stage (New: S3-31 proposal); Close and Withdraw post their lines under the assigned officer's name and cancel open requests; Withdraw a request; Key details with the assigned officer (S3C-8 proposal), the reference added later, visa lodged by. (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Engineering walkthrough, 1 Nov: Change status groups the Application stage into **Before submission** and **After submission**; new status **Additional documents submitted to university**. Queues share work by **Fewest open** or **Record owner** only (round robin gone; SEA Admissions is Fewest open). (1 Nov, commit "Merge w-*: 1 Nov walkthrough")

The GSP Team role (the Role switch beside Prototype) starts as a copy of the agency portal, seen from GSP's side. What changes here doesn't touch RP Admin.

- [x] Nesil, 27 Oct: the logo reads **GSP Team** instead of Partner Portal.
- [x] Nesil, 27 Oct: applications are seen **from GSP's side**: **Pending from you** is what GSP has to do, what the agency has to do is **With RP**, and the university's stays With university. In the tiles, the status column, the order (GSP's first), the CSV, the application's corner tag and banner ("With RP: 2 things to do", See them), and GSP Assist's status answer. Owner colours stay with the party: violet GSP, amber the agency, blue the university.
- [x] Nesil, 27 Oct: the application list shows **counsellors by name, with no "(you)"** (Key details too; the counsellor filter lists names, no "My students").
- [x] Nesil, 27 Oct (2nd round), the application page:
  - **Mail**, a tab beside Chat: the university's mail about the application. Open, read, reply, forward, write a new one or keep a draft; **Summarise** has GSP Assist sum up the open mail.
  - **Submission**, a tab: where it's submitted (through mail with the address, or StudyLink or the university's portal with the link, username and password, the password hidden behind an eye, each to copy), and the **university reference**: added only once the application is submitted, edited after a confirmation.
  - **Change status**: GSP's team overrides the status, picked from the list, with a short reason; both go into Activity.
  - **Census date** and **Final tuition fee** in Key details, filled in by default and editable.
  - The chat's **Request document** template: a title and a line on what's needed (and an optional due date), sent to the RP. It also appears in Documents, as the chat Decision says.
  - **Documents** filters to **Student's documents** or **Documents by GSP**, with chips rather than tabs (no tabs inside tabs).
  - The page acts as GSP now: the agency's uploads and Send to GSP became a read-only **With RP** list, the chat is GSP's (no GSP Assist replies), and the side card is the **RP contact**.
  - Open question: should a status GSP sets by hand be marked as set by hand where the RP sees it?
  - [x] ~~Open question: where do the real census date and fee come from?~~ Fee answered by Jovial, 1 Nov: Admissions changes it from the offer letter (see 1 Nov below). The census date is still open.
- [x] Nesil, 27 Oct (3rd round): **no backup applications** in GSP Team either, as in RP Admin: no On hold status, no Backup tag, no "Waiting as a backup" banner, no "alongside or as a backup" choice in Add an application, which now ends with **"Waiting for documents."**
- [x] Nesil, 27 Oct (4th round): signed in as **Freddy Forrest, GSP** (the sidebar, the top bar and Home's greeting); GSP's actions are his.
- [x] Nesil, 27 Oct (4th round): **reviewing the RP's documents**: To review first in Documents, a preview of each, **Accept**, or **Reject** with a reason, which sends it back to the RP to upload again.
- [x] Nesil, 27 Oct (4th round): for testing, **RP Admin and GSP Team can be connected** (one application or all), so a request or a status change in GSP Team shows in RP Admin, live in **side by side**.
  - Open question: when GSP rejects a document the RP uploaded to the student's profile, should the profile copy be marked too, for the student's other applications?
- [x] Nesil, 27 Oct (5th round): **no GSP Assist for GSP's team** in the chat (its replies to the RP don't show in GSP Team) or in document review (no "GSP Assist read it" in the preview or under the RP's uploads). Mail's Summarise stays. This answers, for GSP Team, the Application page's open question on GSP Assist in the chat; the RP's chat is unchanged.
- [x] Nesil, 28 Oct: **Student's documents** is the application's own list, as the RP sees it; under it, **Asked for when they're needed**: what the course needs only later (references, a gap explanation, financial documents), each with **Request**, which opens the chat's template. Changing the status to one that needs a document from the RP (the deposit proof, the visa lodgement proof) asks for it in the chat, from the GSP person; requests made for the old status close. (28 Oct, commit “Each application asks for its own documents; later ones come as GSP’s requests”)
- [x] Nesil, 28 Oct, the stage and status concept in GSP Team: **Change** lists every status by stage with **how each stage can close**, and GSP moves every status but New to Pre-screening (accepting the last document no longer readies an application on its own, as decision 25 in PLAN.md had it). Rejecting at a review step puts the application back on the RP's step, and the rejection is a request. **Request conditions**, a second chat template: each condition a document or a question, sent as a form; the answers show on its card and in a **Conditions** card in Documents. **GSP Assist in the mail**: when a university document arrives (offer letters, the CoE or CAS, the visa), a nudge offers to add it to Documents by GSP and tell the RP (Yes, add to documents, or No), with the file to preview and download. A status needing a document from the RP (Tuition or deposit pending, Visa lodgement pending) asks for it in the chat. (28 Oct, commit “The 8 stages and their statuses, moved by GSP; conditions form, mail nudge, preview and download”)
- [x] Nesil, 28 Oct (2nd round), the application page: **Change status** has **Stage** and **Status** as two lists and optional **Remarks**. The chat's attach button and the condition type (Document or Question) line up with the fields, **GSP Assist's mark** heads the chat (its replies still don't show here), and **Request document** and **Request conditions** are larger, in GSP's colour. A **conditions card** in the chat opens the form in a dialog. The **RP contact** comes first, without its chat button, then Key details. **Documents** is one card in tabs, as in RP Admin: All, **To review**, With RP, Approved and **Conditions**, each conditions form a card that opens in the same dialog; "Asked for when they're needed" is gone. (28 Oct, commit “GSP Team application page: stage and status apart, Documents in tabs, conditions open as a card”)
- [x] Nesil, 28 Oct (3rd round), the application page:
  - **GSP Assist's nudge by status**: the conditional offer letter at Conditional offer received, the unconditional offer letter at Unconditional offer letter received, the acceptance letter at Awaiting acceptance letter, and the visa grant at Visa granted (no other status shows one). No more "undefined" in the file name when there's no university reference.
  - **Change status**: no remarks; Stage and Status **drop down from their fields** and start at the current stage and status; choosing a **Closed** status asks first.
  - **Rejecting a document** puts it at its stage's **Document re-upload pending**, with the RP.
  - **More** has no Change status and no Write to the university.
  - **Documents**: uploading asks for **the document's name**. **By GSP** has no date and no "By GSP" pill. **Conditions** counts each set as one, and its card has the same border all round. Numbers sit in the middle of their circles.
  - **The preview** has Accept and Reject, and **Previous and Next** to move through the documents; after a decision it moves on to the next one to review.
  - **Request conditions** in the chat is questions only: no Document or Question to pick.
  - This changes the 2nd round's optional Remarks and the condition type beside each condition. (28 Oct, commit “Document re-upload pending in every stage; status dropdowns, nudge per status, review steps”)
  - Open question: the visa grant comes to GSP by mail from the immigration authority here. When the RP lodges the visa, does GSP get the grant, or does the RP upload it?
- [ ] Still the agency's for now: Home (beyond the greeting), Students and Find courses.
  - GSP Team's copies of Find courses, the course dialog and the onboarding documents dialog are from before RP Admin's 27 Oct (2nd and 3rd round) changes: QS ranking on the cards, Study mode and total tuition in the dialog, the centred documents dialog, "Needs your attention", and (4th round) Campus life photos, the dialog expanding to fill the window, and disciplines and levels. GSP Team's dialog keeps its five facts in one row (its own style in gsp.css, since the shared one now lays out four). Bring them in line, or reshape them for GSP when their turn comes.

## GSP · Institution (the Institution Team)

GSP Team members a GSP admin gives access to act for the institutions: they collect the records about universities, courses and agreements and add them to the portal. **Rule (Nesil, 29 Oct): nothing changed for this role reaches GSP Team or RP Admin.**

- [x] Nesil, 29 Oct: **a new role, Institution Partner**, in the Role switch, **replicating GSP Team**: the same screens, with "Institution Partner" beside the logo. Side by side stays RP Admin and GSP Team. (29 Oct, commit “Institution Partner: a new role, a copy of GSP Team”)
  - Answered, 29 Oct: it isn't the university's team but GSP's own Institution Team (below), so who's signed in is Raj Shamani, GSP · Institution, and the university's own view isn't part of it.
- [x] Nesil, 29 Oct (2nd round): **GSP · Institution** in the Role switch and **Institution Team** beside the logo; signed in as **Raj Shamani, GSP · Institution**. **Its own sign-in**: GSP email and password, **Set up your password** the first time (a GSP admin gives access by email; a code to the email, then a password), Forgot password, and **no registering**. **Pages, in order:** Home, Students, Applications, Course search (GSP Team's, as they are), Recruitment partners, Institution partners, Universities, Courses: lists with search and filters, a record for each with Mark as checked (every four weeks), and adding and editing universities, courses and institution partners; recruitment partners to look at only. Home: what needs a look. (29 Oct, commit “GSP · Institution: the Institution Team’s sign-in, portal and records pages”)
  - Answered, 29 Oct (3rd round), from the PM prototype's IP team: yes. **Institution partners** hold the agreements (type, relationship manager, status, documents, commission, contacts) and every **university sits under one partner** and goes live on its own.
  - Answered, 29 Oct (3rd round), from the PM prototype: campuses, scholarships, territory rules, the submission profile, contacts, portal logins and the changes the university sends for a university; status, source, code, tags and a change log for a course. Pictures are counted, not uploaded, for now.
  - Open question: should what the team adds reach RP Admin's and GSP Team's Course search? Today it stays in this role, by the rule above; the real product would share one catalogue.
  - Open question: what does the team do in Students and Applications: look only, or act as GSP Team does (change status, review documents)? They're GSP Team's for now.
  - The GSP admin's side, giving and removing access, is for the Admin view (New pages).
- [x] Nesil, 29 Oct (3rd round): **the PM prototype's IP team flow, in our design**, for its functionality and features. **Institution partners**: Direct, Third-party or Aggregator; a relationship manager; a **status set by hand** (Prospect to Agreement executed, and the closed ones); tiles for executed, before agreement, ending in 60 days, ended and closed; a partner page with Overview, Universities, Documents (the New agreement or Renewal that ends last sets the dates; a renewal reminder 60 days before), Commission (read-only) and Contacts; End partnership; **Add a partner** with **Upload agreement** (its dates, commission and territories read) or **Save as prospect**, a direct partner's university set up with it. **Universities**: each under one partner, Live, Setting up, Paused or Ended; **Go live** once its agreement, a campus, a live course and the submission are there; a page with Overview, Campuses (inactive ones leave Course search), Courses (Read from the website saves drafts), Scholarships, Territory (who can apply, priority markets, blocked states, hidden from recruitment partners), Submission and contacts (forms, contacts, portal logins with every look logged) and Changes (**recorded by one member, verified by a second**). **Courses**: Live, Needs a check, Draft or Hidden; source; **updates the bots held back**, to approve or reject; a course page with Publish, Hide, Preview, Tags and a Change log. **Announcements**, a ninth page. **Home is the team's queue**, oldest first, with Late and Yours. **Recruitment partners**: Export as CSV. Records are pages with one row of tabs (no tabs inside tabs). (29 Oct, commit “GSP · Institution: the IP team’s flows from the PM prototype”)
  - Chosen in the build, for Nesil to confirm: the PM's **Held changes** sit on **Courses** (at the top), its **Commission rules** on each partner (read-only, as the IP team only views them there), and its **My queues** is **Home**; **Announcements** is a ninth page after Courses.
  - Open question: territory, campus and submission edits apply when saved; only the changes the university sends go through a second person. Should the team's own edits be verified too?
    - Answered, 29 Oct (7th round): no second person. The Changes tab is gone; each part of a record says who last changed it, and when. (29 Oct, commit “GSP · Institution: who changed what, and the review’s fixes to every page”)
  - Open question: **announcements** stay in this role, by the rule; RP Admin's top bar, course cards and university page don't show them yet.
    - 30 Oct: RP Admin's and GSP Team's megaphone (top right) now show announcements in this role's model, from their own copy of the samples. What this team publishes still doesn't reach them, by the rule; asked Nesil whether it should, live, while connected. Course cards and the university page don't show them.
  - Open question (Jovial): the relationship managers (Raj Shamani, Kavya Menon, Arjun Mehta, Leena Thomas) and the course bots' rules for holding an update (a fee up more than 10%, an apply-by date moved more than 30 days earlier, a new campus, a change found only in an email, a course page gone) are sample data: where do they come from?
- [x] Nesil, 29 Oct (4th round), on the partner and university pages. **Institution partners:** the status switcher at the header's right, without "Set by hand, in any order…"; types **Direct** and **Third-party** only (no Aggregator), shown as just the type; a direct partner can have **several universities**, and **no university is made for a partner**: a university picks its partner on its own page; documents can be **a PDF, Word file or image**; **Add a partner** without the agreement upload or the "set up with this partner" line, with a required **Status** field, and **Save** on the right. **Universities:** no Checked column and **no check concept**; no commission in the profile; no "The page partners see" section; **Add a university** with the partner found by searching (direct ones too), a **University type**, and no campus or city; **no automation**: the basics first, everything else entered on its page; no Read from the website; **Add a course opens in place** on the university, without the code hint, duration, tuition, application fee, academic minimum, IELTS or intakes (they're entered with Edit course on the course's page, and a draft is published once they're there). **Every pop-up's buttons on the right.** (29 Oct, commit “GSP · Institution: partners and universities, by hand”)
  - Open question: "Assume there's no automation" was said for universities. The course bots' **Updates held for you** on Courses (and the queue's Approve a course update) still assume bots: keep them, or remove them too?
    - Answered, 29 Oct (6th round): remove them. Courses has no held updates, and Home has no Approve a course update. (29 Oct, commit “GSP · Institution: courses, recruitment partners and announcements from the PM”)
  - Answered, 29 Oct (5th round): remove **Needs a check** completely. Courses are Live, Draft or Hidden. (29 Oct, commit “GSP · Institution: no Needs a check for courses”)
- [x] Nesil, 29 Oct (6th round). **A partner's page:** the status shows with a **Change** button (with an icon) beside it; only after Change can the status be picked from the list, then Cancel or Save. **Courses, from the PM prototype, with no extra fields or automation:** no **Updates held for you**; **no Preview**; the course page has the PM's tabs, each saved on its own: **Basics** (code, name, level, study area, duration and its unit, campus, mode, course page, post-study work, tags), **Intakes** (status, and application, deposit, acceptance, batch start and census dates), **Fees** (currency, tuition a year, first-year and full-course fees, application fee), **Academic** (rules by student country, qualification, board, scale, minimum, backlogs, note) and **English** (rules by student country and test, overall and the test's band minimum, note). A draft is published once it has a duration, an intake with its deadlines, tuition, an academic rule and an English rule; **Delete draft**; no Edit course pop-up and no change log. **Recruitment partners, from the PM:** to look at and export only; the PM's statuses (Not activated, Verifying, Documents sent back, Activated, Agreement signed, Rejected, Suspended, Dormant), tiles, filters (status, country, BDM) and documents missing; a page with **Overview** (contact, city, how they found GSP, BDM, admissions contact, Master Partner), **Documents** (with a preview) and **Activity**. **Announcements, from the PM, with no log:** the PM's categories, with subcategories for Admission and System Updates; universities picked from a list; a formatted description with images or PDFs; Send as email; **Recipients** (user type, permission role, RP country, sales region); Preview, Save draft, Publish or Schedule, Withdraw; and **System information** (created by, status, recipients reached, emails sent and opened). (29 Oct, commit “GSP · Institution: courses, recruitment partners and announcements from the PM”)
  - Chosen in the build, for Nesil to confirm: Program level and Study area keep this portal's lists (the 27 Oct review's names, and what Course search filters by), not the PM's. The Courses list keeps its tiles, search, filters and 40 at a time.
  - Chosen in the build, for Nesil to confirm: left out as automation or as the removed check, the PM's **Copy from a similar course**, **Mark checked today**, **Send for check** (a draft is published instead) and the recruitment partners' **automated check flags**.
  - Chosen in the build, for Nesil to confirm: **Add a course** keeps its pop-up with the basics (4th round); the PM asks only for the university, then opens the draft.
- [x] Nesil, 29 Oct (7th round). **Recruitment partner page:** the contact as separate, aligned fields (contact person, email, phone). **Institution partner page:** no legal entity (page and Edit details); no "Taken from … To change the dates…" line on the agreement; no "Universities join a partner…" line. **University page:** the institution partner by name with an **edit icon** beside it, which opens the list to pick another; **public or private** as its own entry; no **typical offer time**; **display priority** a number; scholarships pick **students from, program levels and study areas from dropdowns**, without "Given automatically with the offer"; territory's **All but some** and **Only some** countries ticked in a **pop-up** like the PM's (search, regions, two columns, Select all, Clear); **Submission and contacts** in the order forms, how applications are sent, portal logins, contacts, with no log of who looked at a password; **no Changes tab** (and no Verify a change on Home). **Course page:** a **university** field in Basics, in the order code, name, university, campus, program level, study area, study mode, duration or credits, duration; room before the tags; the tables' dropdowns with the portal's own arrow; the **And** box lined up with the row, its name under it; every box the same height; **All countries** first in the countries dropdown; no post-study work tick. **Announcements:** Publish on is a date, with no time. **Everywhere in this role:** where something is changed, "Last updated by … on …" in small grey italics. (29 Oct, commit “GSP · Institution: who changed what, and the review’s fixes to every page”)
  - Chosen in the build, for Nesil to confirm: "Last updated" shows on the records this team changes (institution partners, universities, courses, announcements): under a status, under each section's title and under an announcement's title. Students, Applications and Course search are GSP Team's pages, and recruitment partners are view only, so they have none. A few samples show it before anything is changed.
  - Chosen in the build, for Nesil to confirm: the partner's edit icon sits on the university's Overview, in its Institution partner section; the name stays a link to the partner.
  - Chosen in the build, for Nesil to confirm: the territory pop-up's regions are the PM's, named as the country list names them (Hong Kong S.A.R., Swaziland, The Gambia, Côte d'Ivoire); picking All but some or Only some opens it straight away, and switching between them starts the list afresh. Scholarships' students from now lists every country, not just the seven main markets.
- [x] Nesil, 29 Oct (8th round): on a university's **Territory** tab, no "In short: …" summary. (29 Oct, commit “GSP · Institution: no In short line on territory”)
- [x] Nesil, 30 Oct. **Institution partner:** every **contact** can be edited (Edit beside Remove, the same form), on the university's contacts too. **University:** **Add a campus** is a pop-up with the campus name, country, state, city and Google Maps link (all needed; the setting is optional), and every campus can be edited the same way; renaming one renames it on its courses. A scholarship's **How much** is an **Amount range**: Percentage or Absolute amount, from and to, then “% of tuition” or a currency to pick (AUD by default); the same number twice is a fixed amount. **Courses:** **Intakes, Fees, Academic and English** show what's saved, read-only, with **Edit**; Edit opens the form, and Save or Cancel closes it (a tab with nothing yet opens on the form). **Fees** has no note; **Full course fee** in place of tuition a year (the old full course fee is gone; Course search works out the yearly figure), and the first-year and application fees are optional; what's needed has an asterisk, in Basics too. **English** has one column for the lowest band or section, so every box and Remove sit level. **Announcements:** the pickers line up with the other fields, and “(empty = all)” labels are “(optional)” with “All …” in the box. (30 Oct, commit “30 Oct review: course search trimmed, the RP on GSP’s adds, Institution edits”)
- [x] Nesil, 30 Oct, when merging (asked on 29 Oct): **the changes made in RP Admin and GSP Team since this role was copied apply here too**: the student profile (Personal details, Documents and Applications with Shortlisted), Add a student (expands, bulk upload), Course search (country chip on the cards, compare up to five and download, shortlist for a student) and the course dialog (Costs with scholarships, entry by the student's country), every notification in the bottom-left corner (this role's confirmations included), and the bell and megaphone. This role's own edits stay: Course search reads the team's catalogue (compare included) and keeps its name. (30 Oct, commit “Glass, sticky bell and megaphone; real notifications while connected; GSP · Institution brought up to date”)
- [x] Jovial, 2 Nov: **the prototype matches the slice 2 PRD** (supply and partner onboarding; gap list `prd-gaps/S2.md`, 80 gaps). Institution partners: state and city, Agreement ended only by job J1, Decision A (Agreement executed by hand after the end date counts as in date), Closed → Paused universities (S2C-19), documents with Current, Download and Remove, contacts with first and last name and phone, a Change log and System information. Universities: Search priority (was Display priority), logo upload, Go live's five checks, Pause confirm, read-only when Ended. Courses: Add a course with every Basics field and Add draft, CSV import with skipped rows, read-only tabs with Edit, intakes date order, fee year, Minimum highest education required, English ranges, Delete rules. Announcements: no Master Partner recipients. BAP: the RP agreement, Reject/Suspend/Reactivate, Mark training done, Issue a notice, region isolation. Master Partners (GSP · BAP). Admin › Course tags. RP portal: Profile locked until verified, the agreement on Home, Email preferences. Every slice 2 page follows Admin › Permission roles for who edits. (2 Nov, prd-s2: d96a7fd, 895f87b, 00a9dd8, 65d6987)

## GSP · Admin

- [x] Jovial, 2 Nov (slice 3 PRD, S3-4, S3-15, S3-16, S3-29): Course configuration › **Grade conversion** and **English test equivalence**, with the seed values; the eligibility check reads each course's Minimum highest education required (slice 2's course form, S3-18). (2 Nov, branch prd-s3, commit “S3 PRD: gap list ticked, README, REVIEW”)

- [x] Nesil, 30 Oct: **a new role, GSP · Admin**, in the Role switch, **replicating GSP · Institution** (the same pages, records, sign-in and design), with **a colour difference**: teal in place of GSP's navy for buttons, links, focus and switches, and in the corner glow and the light behind the sidebar. "GSP Admin" beside the logo; signed in as Ishaan Verma, GSP · Admin. (30 Oct, commit “GSP · Admin: a new role, a copy of GSP · Institution, in teal”)
  - Chosen in the build, for Nesil to confirm: **teal** as Admin's colour (a cool colour that isn't an owner or status colour, and far from GSP's violet and the university blue); the owner and status colours stay the same in every role.
    - Answered, 30 Oct (Nesil): teal isn't looking great; **red and blue** instead: a deep wine red for main buttons, royal blue for links, focus, switches and highlights, and red and blue light in the corner glow and behind the sidebar. (30 Oct, commit “GSP · Admin: configuration pages from the PM prototype; groups open a menu beside the sidebar”)
    - Answered again, 30 Oct (Nesil): the new colours aren't looking good; **the same colours as RP Admin** (every role's). (30 Oct, commit “GSP · Admin: RP Admin's colours”)
  - Open question: what does an admin do that the Institution Team doesn't (giving people access, the Admin view and the management dashboards in New pages)? For now it's the Institution Team's portal.
    - Answered, 30 Oct (Nesil): the configuration below.
  - Open question: like GSP · Institution, nothing changed here reaches the other roles. Should it?
    - Answered by the slice 1 PRD (2 Nov): yes; Admin's settings are one store every role reads (2 Nov, cb40ac9).
- [x] Nesil, 30 Oct: **the menu in groups**: **User modules** (Course search, Students, Applications) and **Institution** (Recruitment partners, Institution partners, Universities, Courses, Announcements) are **GSP · Institution's own pages**, so a change there shows here too, unless a page gets its own setting here; then **User roles** (Sales regions, Permission roles, Queues), **Recruitment** (BDM assignment), **Course configuration** (Currency exchange, Living costs), **Application configuration** (Application routing, Document configuration) and **Other configurations** (Filters configuration, Logs). Picking a group opens **a small menu beside the sidebar** with its pages (Nesil's reference), not a drop-down. Every change in these settings is logged, and Logs shows them with the download log. (30 Oct, commit “GSP · Admin: configuration pages from the PM prototype; groups open a menu beside the sidebar”)
  - From the PM prototype's Super Admin › Settings: Sales regions (with each region's Admissions contact), Permission roles (the 25 Oct access matrix: 30 objects × 14 roles, No access to Manage), Queues (5 team queues and an Admissions and a Recruitment queue per region; members from people's roles and regions), BDM assignment (its table, matching order and add/edit form), Application routing (the six rules, the test with its trace, regional RP lists, region defaults), Document configuration (the 20 application document rules, and recruitment partner documents by country) and the download log.
  - Not in the PM prototype, so built from this prototype's own figures, **for Jovial to confirm**: **Currency exchange** (course search's rates to INR), **Living costs** (the course dialog's visa figures per destination) and **Filters configuration** (the filters course search, Applications and Students have, to show, hide and order).
  - Chosen in the build, for Nesil to confirm: **Home** (the queue) stays first, above the groups; the PM's **Task rules**, **Portal login access**, **Nationality to region** map and **Document categories** aren't built yet.
  - Open question: the settings here are this role's own (a changed currency rate doesn't change course search in the other roles yet). Should they drive the other roles?
    - Answered by the slice 1 PRD (2 Nov): yes, other slices only read them (2 Nov, cb40ac9).
- [x] Nesil, 30 Oct (later), under **User roles**: **Create roles** (name, email, phone, role from Admin, Recruitment, Recruitment Ops, Admission, Admission Ops, Institution, Institution Ops, Finance; title; sales region; the list with filters, Export as CSV, edit and delete, and **Send login link**); **Sales regions** add, edit and delete; **Queues** as a name, a leader (one) and members (several), created, edited and deleted; **Emails**: email groups (email, email sync, sync start date) and their users, each Only view (the default) or Can send. (30 Oct, commit “GSP · Admin: Create roles, sales regions, queues and emails”)
  - Answered, 31 Oct (Jovial): nine roles, three levels (see below).
  - Open question: Create roles has Nesil's eight roles; **Permission roles** still has the PM's fourteen (Admissions, BAP, Data team, IP team…). Should Permission roles move to the eight (plus the RP roles), and which PM role does each map to? In the samples: Admissions → Admission, Admissions Head → Admission Ops, BAP → Recruitment Ops, IP team → Institution, Data team → Institution Ops, Commissions & Finance → Finance, Super Admin → Admin.
    - Answered by the slice 1 PRD (2 Nov): nine roles named Admin, Admission, Global Ops, Recruitment, RP Ops, Institution, IP Ops, Finance, View Only, in Create roles and Permission roles alike (2 Nov, f2fd1ef).
  - Chosen in the build, for Nesil to confirm: a user has **one** sales region (Global for those who cover all), as the dropdown asked; the PM let GSP users have several. Queues lost the PM's assignment, time to act and away cover; members are picked by hand rather than following roles and regions.

- [x] Jovial, 31 Oct, on the Admin configuration pages (in our own copy, `jovial-upgrad/gsp-portal`; 0d52cf9):
  - **Other configurations:** Filters configuration removed. **Logs** is the download log only: filters Role, Person and a date range; columns Date, Time, Name, Role, Filters applied, Rows. No Changes or Downloads switch.
  - **Application routing:** read-only until **Edit**, kept only on **Save** (Cancel throws it away). Regional RP lists: add a region; add RPs from a searchable multi-select. Region defaults: **Add sales region** (name, Admissions contact, default BDM, queue); default BDM from a single-select of Recruitment users; Admissions queue editable. Rest of world and Direct: BDM Ali, queue **Global Admissions** (a new queue led by Tasha).
  - **Currency exchange** and **Living costs:** Edit, then Save; **Get today’s rates** / **Get current figures** fill the table to check before saving (simulated in the prototype); rows can be added for more destinations.
  - **BDM assignment:** states and cities in one searchable multi-select; the BDM is a single-select of Recruitment users.
  - **Create roles:** the dialog has two buttons, **Cancel** and **Create user** (the login email goes on creating). Each user can be **deactivated** (and activated again) or sent the **login email again**.
  - **Sales regions:** no Countries column; the Admissions contact is required, picked from Admission and Admission Ops users.
  - **Permission roles:** the nine GSP roles (Admin, Admission, Admission Ops, Recruitment, Recruitment Ops, Institution, Institution Ops, Finance, View Only), each from the PM role it replaces. Pick a role, pick what, choose **No access, View or View + edit**, Save; the role’s full list below.
  - **Queues:** the leader shows without their role.
  - **Document configuration** and **Email group users:** Edit, then Save. Every application document rule can be edited; **Applies when** is set from study levels, university countries, where the student is, and anything else.
  - **Staff:** Jovial’s list everywhere in Admin (Admin is Jovial), queues for every region with their leads, and the shared mailboxes from the inbox analysis.

- [x] Jovial, 31 Oct (evening): **the staff export is the only list of GSP users** (`src/data/staff.json`, 172 people: name, email, permission role, sales regions, and the area each BDM covers). Every person anywhere reads from it: Admin › Create roles, every person picker, the person each role signs in as (Jovial Lejo, Ramish Jafery, Saurabh Chaudhary, Garima Bhardwaj, Suman Verma, Kevin Mcewan), queues and their members (each region's Admission people; each team's role), tasks, Mail, Finance's makers and checkers, the RP's partner manager (by the BDM's area) and GSP contact, and the Institution team. (31 Oct, 54183fa)
  - Answers the 30 Oct choice above: a user now has **one or more** sales regions, as in the export.
  - The export has no phone numbers or titles, so none show; contact cards show the email instead.
  - Open question: the export's own inconsistencies (two Sumit Singhs, Faryal Abbas twice, notes inside names, region spellings, a shared mailbox as Faisal Khan's email, BDM areas that overlap or disagree with BDM assignment) are listed in the QC doc. Who fixes them in the CRM?

- [x] Jovial, 31 Oct (evening): **one application data set, connected across every module**, and working for the commissions demo (`src/data/dataset.json`, built by `scripts/gen_dataset.py`; read through `src/data/dataset.ts`). (31 Oct, 7260c61)
  - **86 applications**: the sample agency's 9 (unchanged) plus 77 more: the 47 CRM-shaped applications from the work sample (every stage, real RPs and universities) and Finance's 30 enrolments. One id each (GSP-#####); the old sample ids (A00391…, A00401…) map to them.
  - Each application points by id to its **student** (77 more students), its **course** and so its **university**, its **RP** (Finance's RP id) and its **GSP owner** (a staff id). The RP portal shows only the agency's own; every GSP role sees all.
  - **The catalogue** gains the 29 universities the applications use; **every university's commission rate comes from Finance's terms** (18 catalogue universities with no contract get sample terms, marked as such), so course cards, the Commission tab and Finance agree.
  - **Finance** prices the same applications: invoices, university payments and RP payouts follow the dates (some held back to show overdue payments, a short payment and RPs in the next run). The **Commission tab** shows Finance's own lines for enrolled applications; RP Earnings matches both.
  - **My work** and **Mail** link to the same applications; **confirming a status in Mail changes the application in every role**, and an application Mail marks enrolled joins Finance's ledgers at once (`src/data/live.ts`).
  - **RPs**: one list for the RP pickers and the Institution Team's Recruitment partners page (every RP an application is with); the sample agency is the GSP test agency everywhere.

- [x] Jovial, 31 Oct (evening, in the QC doc's inventory): **Admin and the Institution catalogue are the sources** (31 Oct, 5ab1700 and 1a7f2a7)
  - **Admin's settings are saved and shared:** one store every role reads (`src/admin/data/store.ts`).
  - **Currency exchange is the one source:** rates in AUD per unit, kept by week; course search's lakh budget and Finance's pricing both read it. Finance's FX card is read-only and points to Admin.
  - **Living costs** and a new **Visa and health fees** page (set up like Living costs) feed every course page's costs.
  - **Document configuration** decides the documents asked for when an application is added (New stage, uploaded by the RP, where the rule applies); the English test still comes from the course. **RP documents** for sign-up and on the RP page come from its RP rules, India and everyone else.
  - **BDM assignment** starts from the staff list's areas, and a new RP's partner manager comes from it.
  - **Download log:** every CSV downloaded anywhere is logged with who, role, page, filters and rows.
  - **Course search in every role reads the Institution catalogue:** live universities only (a paused one disappears), live courses, territory, campuses; scholarships on the course's costs come from the university's record; each intake shows its **start and census dates** (also answering the Course page item above for start and census), and applications, the GSP submission card and Finance use the same dates. The submission channel and logins on GSP's application come from the university's record.
  - **Passport validity** removed everywhere (the profile field, its warnings and the completeness check).
  - The university's commission rate is Finance's, not the Institution partner record's.
  - Open, in Jovial's sheet *GSP portal: inputs from Jovial*: permissions, sales regions, nationality map, routing rules, queues, mailboxes, and 23 questions.
  - Parked by Jovial: **grade conversion** (percentage to GPA, CGPA to percentage). Pick it up at the end.

- [x] Jovial, 31 Oct (night, his *Pending Questions* sheet): **his answers built in** (31 Oct, bf93246)
  - **Held changes** removed (it was the queue of course edits waiting for Institution's approval; no longer a permission row or a screen idea).
  - **Permissions** are his matrix (Admin, View Only, Finance, Institution, Institution Ops, Recruitment, Recruitment Ops, Admission, Admission Ops).
  - **Sales regions:** Myanmar and Bhutan are separate; contacts and default BDMs as in his table; Rest of world and Direct kept. **Queues:** one **SEA Admissions** queue (Vietnam, Indonesia/Malaysia/Thailand, Myanmar, Bhutan) led by Truc; Philippines led by Kimberley; China led by Caixia; Admission Ops also takes unmatched mail. Nationality map: UAE, Canada and US go to Rest of world.
  - **Mailboxes:** the five real ones (admin.gsp@, bap.gsp@, commissions.gsp@, data-team.gsp@, gsp.admissions@), each feeding its queues; everyone in those queues sees and sends; Admin sees all.
  - **Staff:** sumit.singh only; Faryal Recruitment only; Kartik Recruitment Ops; Satinder Admission Ops; Riya Shah owns Ahmedabad; every person has a phone and title (sample).
  - **Courses:** go live with just an intake and its deadline; an intake up to 2 weeks past its deadline shows as **Late: likelihood is low** (Admissions decides); accreditation, careers and the MBA work-experience field removed; study mode and tags come from the course record; optional **CRICOS course code** on Australian courses.
  - **Acceptance documents by destination** in Document configuration (CoE, CAS, I-20, LOA and PAL, Offer of Place, Letter of acceptance).
  - **Announcements** for a university show on its course pages in course search (RP: only those meant for RPs).
  - **Priority market chip** on the Applications list and the application page, GSP roles only, when the student's nationality is a priority market for that university (from the university's territory).


- [x] Jovial, 1 Nov (his *Pending Questions* sheet: Status triggers, Who has it, Task triggers, Queue assignment, Sales region rules, Region isolation, Hygiene and Walkthrough findings): **built** (1 Nov, 05249dc)
  - **Statuses move by hand.** The only automatic move is New to Pre-screening when the RP sends the application; sending a document back still moves it to that stage's re-upload pending (his OK).
  - **Tasks follow the status** (`src/work/engine.ts`): every application rule from his Task triggers sheet, with SLAs and waits in working hours (9:30 to 18:30; Monday to Friday, Sunday to Thursday in Bangladesh). A status change, forward, back or closed, closes the old tasks; the officer can also close one with Done. Escalation: leader at the due time, the team's Ops queue after 2 working days, Admin after 5.
  - **Who has it:** On RP, On GSP, On university. An open request puts it on the RP; documents waiting for a check put it on GSP; otherwise the status. Awaiting acceptance letter is the university's; a conditional offer is GSP's until the conditions go to the RP (Change status asks for them); who lodges the visa is chosen when moving to Visa lodgement pending.
  - **Requests from a later stage pause** when the status moves back and come back when it returns.
  - **RP messages and uploads** give the officer a "Needs you" in My work; Connect covers every GSP role.
  - **Assignment:** fewest open applications in the regional queue (round robin in SEA), skipping people on leave (each person sets leave on their Profile); the leader covers people on leave or deactivated; anyone in the team can reassign. One queue editor (Work › Queues, SLA and escalation) and one user list (Admin › Create roles).
  - **Mail:** checks the application's stage before suggesting a move and files the attachment in Documents; admin.gsp@ goes to Recruitment Ops; newsletters to Admission Ops; matched on the university reference.
  - **Sales regions** (`src/data/regions.ts`): one country map; an RP's region from its head office (a regional list wins), a branch's from its country, a student's from the RP branch that added them, an application's from the routing rules, shown as "routed by rule N".
  - **Region isolation, model D** (`src/data/scope.ts`): Admission and Recruitment see their own regions in Students, Applications and My work, and can look across every region read only (logged); outside their regions an application can't have its status changed.
  - **Hygiene:** one form kit, one edit model with "Discard changes?", inline validation, red confirms and Undo, one money and date format (H1–H47 except H22 partly and H4 done separately).
  - **Walkthrough W1–W34:** applications with their own RP, documents and history; BAP verifies RPs; each GSP role's own Home; GSP staff Profile with leave; Finance reads agreements and territory from the Institution records; payout on Thursday; clawback line; no commission in GSP course search.
  - **Commission on the records:** read-only summary of Finance's terms on each institution partner and RP; Recruitment Ops and Finance can change an RP's bank details there. Changing bank details needs a bank letter, and Finance verifies it.
  - Open, in his sheet: which English test fields are required (Test fields tab).

- [x] Jovial, 1 Nov (morning, in chat): **course search, application and RP onboarding fixes** (1 Nov, 9cedc2b)
  - **Course page Costs:** tuition, living costs, visa and health cover for the course's length (1 year when it's in credits) and the application fee, with a total; living costs and visa and health cover from Admin; no "Other costs", no "after scholarship". Scholarships show only their record. Documents come from Admin › Document configuration. Shortlist is off until the RP has a student.
  - **Application:** the university's own form (Institution › Submission and contacts) shows on Add an application with its template to download; the RP can upload any other document and name it; a calendar on date fields; What's needed is optional in a document request; Change status asks only stage and status (and who lodges the visa); the payment proof is asked for by hand; new status **Acceptance letter received** (Mail's CoE/CAS email suggests it, not the visa step); the final tuition fee starts as the course's fee (replaced by Jovial's decision below).
  - **RP onboarding:** a nudge to add state and city, showing the partner manager they decide.
  - **UI:** list names on the role Homes start at the left; one "* Required" note on Add a student.
- [x] Jovial, 1 Nov (afternoon, in chat). **Decision: the final tuition fee on the application is the only source of the tuition fee.** It starts as the course's fee, Admissions changes it once the offer letter arrives (who and when shown beside it), and every commission works from it: the base commission in Key details, the Commission tab's university instalments and RP payments, and Finance's invoices and payouts. Courses carry no scholarship, so nothing is taken off; the course-level Scholarship row is gone from Key details (university scholarships stay on the university's page). (1 Nov, commit "Final tuition fee is the only tuition source for commission")

- [x] Jovial, 2 Nov: **the slice 1 PRD built**, line by line (gap list in `prd-gaps/S1.md`, 100 items). The role and region names (Global Ops, RP Ops, IP Ops; Indonesia Malaysia & Thailand, Latin America & Europe); 12 roles in the Role menu (S1-1); the permission matrix; page states and their copy; Admin home; GSP users; Profile with Email preferences; GSP sign-in and passwords; Sign-in security and the account emails; Sales regions with every field and the nationality map; routing; BDM assignment; shared mailboxes; currency exchange with Fetch with AI; Living costs and fees; intake timings; Document configuration (10 rules); Logs with every kind. The Queues page under User roles is gone (S4-1); Global Ops and Global Admissions are one queue (S4-20); no quality check (S4-21); no switch to see other regions. (2 Nov, f2fd1ef, cb40ac9, 410ad51, c0b7349)
  - Against earlier review items, as the PRD says: Logs shows every kind (31 Oct: download log only); Sales regions has a Countries column (31 Oct: none); no "look across every region" switch (1 Nov). None was marked Decision.

## New pages

- [x] Jovial, 31 Oct: **My work** and **Mail** in the code (`src/work/`). My work (tasks from the task rules, by queue, with working-day SLAs) is in every GSP role; Admin's new **Work** group has **Queues, SLA and escalation** and **Task rules**. (31 Oct, 3970d0a)
  - **Mail, rethought** from today's inbox (31 Oct screenshot): one row per **conversation**, not per email (replies and duplicates fold in); each already **linked to its application**, with how sure and why, and **owned** by the application's officer (no case numbers to assign by hand); a **state** (Needs you, Check the match, Waiting on others with a timer, Done) and an SLA on every row; an **AI summary**, what was read from it, and **one next step** to confirm (change the status, raise a task, pass the RP's answer to the university, answer in the RP chat, send to Finance); a reply **drafted in context**, sent as the mailbox to the right side, after which the conversation waits; **bulk done**; keys j, k, e, r. GSP's own notifications, newsletters, one-time codes, acknowledgements and bounces are **filed on their own**, with their share of the inbox. Phones show the list, then the conversation.
  - GSP · Admissions' menu: Home, **My work**, **Mail**, Applications, Students, Find courses, Profile. Earnings is gone from Admissions (it's the RP's).
  - Open question: My work, Mail and Admin's Queues page keep their own sample data for now (Admin › User roles › Queues edits leaders and members; Work › Queues, SLA and escalation holds SLA and assignment). One queue model when the work API is designed (Rishi).
    - Answered, 2 Nov (slice 4 PRD, S4-1): one queue editor, Admin › Work › Queues, SLA and escalation; Admin's routing, mailboxes and Home read the same list. (2 Nov, prd-s4 e8a7976)
- [x] Jovial, 31 Oct: **seven roles** in the Role menu: RP Admin, **GSP · Admissions** (GSP Team renamed), **GSP · Recruitment** (Saurabh: recruitment partners, students, applications, course search, announcements), **GSP · BAP** (Garima: recruitment partners, applications, course search), **GSP · Finance** (Suman), GSP · Institution and GSP · Admin. Recruitment, BAP and Finance use GSP Admin's portal with their own menu (`admin/portal/model.ts`, `VARIANTS`). (31 Oct, 9ff7caf)
- [x] Jovial, 31 Oct: **commissions in the code** (`src/finance/`, ported from the add-on prototype with the sandbox's engine): GSP · Finance has Home (today's jobs), Applications, **Commissions** (University invoices, RP commission, Payout run, Exceptions, Reports), **Setup** (Commission terms, Finance setup, How Finance works) and Records (Recruitment partners, Universities). Every university line and every RP line opens **How it's worked out**. (31 Oct, 9ff7caf)
  - **A Commission tab on every application**, beside Chat, Documents, Submission and Activity, in every role. GSP roles see both sides, university to GSP and GSP to the RP, each line with its working; **RP Admin sees only its own side** (its rate, its amounts in its payout currency, why), never GSP's commission or the university's rate. Before enrolment every line is an estimate; a university with no terms in Finance yet uses the course record's rate, flagged for GSP.
  - **RP Admin's Earnings** is no longer a placeholder: the agency's commission, its tier progress, the invoice to approve before pay day, and bank details.
  - Open question: the application's Commission tab and Finance's pages use separate sample data for now (Finance has 30 sample enrolments). They join when applications and commissions share one data model (Rishi).

- [ ] **End-to-end admissions flow**, including the university states, in the **counsellor** and **GSP admissions** views. Nesil and Jovial, by **Wed 28 Oct**.
- [ ] **Admin view.** Nesil and Jovial, by Thu 29 Oct.
  - Nesil, 29 Oct, in RP Admin only: Profile has **Branches** (name, country, state, city, branch BDM set by the system) and **Team** (name, email, phone with country code, role, branch), with adding, editing (moving someone to another branch included) and removing each.
- [ ] **GSP management dashboards.** Nesil and Jovial, by Thu 29 Oct.

- [x] Slice 4 PRD "Operations", 2 Nov (decisions S4-1 to S4-28): **My work**, **Queues, SLA and escalation**, **Task rules**, a new **Emails and daily jobs** page and **the bell** match the PRD (gap list `prd-gaps/S4.md`; README "Design decisions: Operations"). (2 Nov, prd-s4 e8a7976 and the commit with this line)

- [x] Jovial, 2 Nov: **the commission engine handles every scenario on the commissions team's sheet** (Commission_2.xlsx: IP 1–19, RP 1–7) and the cases where they combine, end to end, with each line's working in full (`prd-gaps/S5-commissions.md`). One engine (`src/finance/engine.ts`) for the portal, the standalone **Commissions Sandbox** (`npm run build:sandbox`) and the test (`npm run test:commissions`: 33 cases, 159 hand-worked checks, all pass). New: rate rows by course, campus, region and study period; academic-year and intake tiers by intake; University groups (S5-22) with college and group tiers; university promotions; gross or net (S5-7); chargeable time and payment by year, semester, term, unit or fees paid; agreement start and versions (S5-2); bonus and additional commission; GSP's tier top-ups invoiced before the RP's are paid; RP promotions by intake and region group, % of tuition, the 100% cap, the two-condition special lead, tier rework at period end (S5-15). GSP · Finance gets Commissions › **Commission scenarios**; the application's Base commission is the engine's estimate. 19 proposals listed for Jovial's sheet. (2 Nov, commissions-26, commit “Commission engine: every scenario on the commissions team's sheet”)

## Others' actions (for context)

- Jovial: data source for every field and piece of copy; research what Summary, Documents, Chat and Activity mean on other portals; examples of each chat template.
- Rishi: product architecture and data needs while the designs are finished.
