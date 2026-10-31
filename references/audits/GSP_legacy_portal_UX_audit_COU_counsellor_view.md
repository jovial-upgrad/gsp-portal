# GSP Legacy Portal (staging) – UX Audit, Agency Counsellor ("COU") view

**Environment:** https://stage-legacy-gsp-portal.upgrad.dev/
**Date of audit:** 25 Oct 2026
**Viewport:** 1054×732 (desktop)
**Companion reports:**
- `GSP_legacy_portal_UX_audit.md`: GSP Staff / Admin
- `GSP_legacy_portal_UX_audit_BOA_agency_view.md`: agency Branch Admin

Screens that behave the same as in those reports are summarised here; differences are spelled out.

**Test data created with this login:**
- Student 128813 "Test Student COU QA" (test.student.cou.qa@example.com)
- Enrolment E00102513 (CQUniversity Australia, Brisbane, Mar 2027)
- Application A00175350 (Bachelor of Information Technology, 08-Mar-2027)
- One dummy PDF on the application

**Not done:** nothing was deleted, and no email, mention, live-capture request or QR download was sent.

**Different entry point:** this time I created the student from **My Students → Add Record**, not the course-search wizard. That covers the second way into the main flow.

---

## 1. Login, role and navigation map

### Logged-in user (from "My Profile")

| Field | Value |
|---|---|
| Name | "Jovial" "Unilink" |
| Email | jovial.lejo+COU@upgrad.com |
| User ID | 128720 |
| "User Type" | "Recruitment Partner" |
| "Permission Role" | **"Counsellor"** |
| "User Status" | "Has Portal Access" |
| "Job Title" | empty |

- Agency "Unilink Global Solution", branch "Dhaka Office".
- In the counsellor pickers this user appears as "Jovial Unilink", **the same display name as the Branch Admin user**. That is why the Branch Admin saw "Jovial Unilink" twice in the Counsellor dropdown.

### Navigation map

**Home: 13 tiles.** "My Commission" and "Institutions" are removed.

- Course Search → `/course/search`
- My Students → `/manage-students`
- My Enrolments → `/manage-enrolments`
- My Applications → `/manage-enrolment-course`
- Channel Partners → `/recruitment-partners`
- My To Do → `/case`
- My Inbox → `/emails`
- My Events → `/my-events`
- Dashboard → `/dashboard`
- GSP Academy (external)
- Accommodation → `/accommodation`
- Health Cover → `/oshc/get-quote`
- Internships (external)

**Header:** same as the Branch Admin.
- "?" Help: "Contact Admission", "Contact Commission", "Contact System Admin"
- Gear: "Contact List", "OSHC Policies"
- Megaphone, Bell
- Avatar: "Update Profile Image", "My Profile", "Logout"

**My Profile tabs:** "My Profile", "Email", "Notification Alert Channel", "Announcement", "Student QR" (QR tab also present for counsellors).

### Typing restricted URLs directly

- `/manage-commission-transaction` → "Oops! Permission for this action is denied."
- `/manage-institutions` → "Oops! Permission for this action is denied."
- Both pages are plain text on an empty page, with no link back and no explanation.

### What this role can and cannot do

| Area | Admin | Branch Admin (BOA) | Counsellor (COU) |
|---|---|---|---|
| Home tiles | 15 | 15 | **13** (no Commission, no Institutions) |
| Students visible | 84,092 | 440 (agency) | **only own** (0 before this test) |
| Enrolments buckets | all | agency | own (1 / 0 / 0 / 0 after test) |
| "$" commission icon in course results | shown | shown | **hidden** |
| "Commission %" on partner profile | shown | shown | **hidden** |
| Agency-level counts on Channel Partners | – | shown | **shown** (262 / 145 / 9 / 154) |
| GSP staff notes about the agency | – | visible | **visible** |
| Enrolment record tabs | incl. Commission | incl. Commission | **no Commission tab** |
| Dashboards | ~230 | "RP - Awaiting Action", "RP Pipeline", "Test ui" | same 3, scoped to own records |

---

## 2. Page-by-page findings

### 2.1 Home
- Same layout, 13 tiles. No counts, tasks or alerts.

### 2.2 My Students (`/manage-students`)
- **Empty state, written twice:** before the test the page showed **two messages**, "No Record Found." under the header and "No Records Found" below the pagination, with "Showing 50 out of 0 items".
- **Kebab:** Detail View, Add Record, Delete Record (disabled), Sort Records, Advanced Search.
- **"Add Record"** opens the **same 44-field student form, with 18 required fields**:
  - "Recruitment Partner*" offers only "Unilink Global Solution", "RP Branch*" only "Dhaka Office", and "Counsellor*" only "Jovial Unilink" (the counsellor themselves).
  - **None are pre-filled**, so a counsellor makes 6 clicks to choose the only possible value three times.
- **Duplicate check (new finding):** typing an email that already belongs to another counsellor's student showed "Email already exists. Please try another email address."
  - The counsellor can't see that student and isn't told who owns it.
  - The message tells them to use a different email, which encourages duplicate records.
- **Future date of birth accepted:** DOB **10-Nov-2026** (in the future) was saved with no warning.
- **Success message:** "Successfully Created a Student." appears here. The wizard route shows no message for the same action, which is inconsistent.
- **The work-experience bug is narrowed down:** when "I have worked after my studies" was answered **No**, it saved as "No". The "Yes" bug in the other two audits happens only when the question is **left unanswered**.
- **Student record** (`/manage-students/view/128813`)
  - Left tabs: Student | Documents | History | Cases | OSHC | **Events**.
  - Right tabs: Enrolment | Notes | Contact.
  - Icons: watch, delete, edit, institution, heart.

### 2.3 Creating an enrolment from the student record (non-wizard path)
- **Route:** student record → Enrolment panel kebab → "Add Record" opens "Enrolment Details".
- **Differences from the wizard:**
  - "Institution*" and "Campus*" are empty and must be chosen. Campus is disabled until an institution is picked.
  - Institution search "CQU" returned "CQUniversity Australia" and "Macquarie University" (matched on "cqu" inside "Macquarie").
  - The campus list shows names only.
  - Commencement Year was again pre-filled "2026".
- **Result:**
  - E00102513 was created at stage **"New"**, not "Pre-Screening", because it has no application yet.
  - The page then went straight to the enrolment record. No success message was seen.
- **Enrolment record tabs:**
  - Left: Enrolment | Documents | History | Cases | Events | Applications. **There is no Commission tab for counsellors.**
  - Right: Student | Notes | Announcements.
  - Icons: watch, **delete**, edit.

### 2.4 Creating an application from the enrolment (non-wizard path)
- **Route:** Applications tab → kebab → "Add Record" opens **"Create Application"**.
- **Fields:**
  - Course Commencement Date*
  - Application Type*
  - Institution* (pre-filled "73 - CQUniversity Australia", with an internal ID prefix)
  - Campus*: **not pre-filled**, although the enrolment already says "Brisbane"
  - Course* (disabled until campus)
  - **"Type of Student*"** (New / Transfer / Progression). **This field does not exist in the wizard.**
- **Course picker:** course names only, with no fees, intakes or entry requirements.
- **No territory warning** appeared for CQUniversity, unlike Abertay.
- **Commencement Date picker:** again a free calendar, not the course's intake dates.
- **Success modal:** "Successfully Created Application" / "Primary Application is successfully created and it's Commission transactions are successfully created." Commission worked for this institution (the "it's" typo is in the original).
- **Bug: the page stayed dimmed after clicking OK.**
  - The dark overlay stayed on screen and no tab or button responded, even after pressing Escape.
  - Only a page reload fixed it.
- **Application record** (`/manage-enrolment-course/view/A00175350`)
  - **Tabs:** Application | Documents | Cases | History (no Commission).
  - **Extra questions shown for this institution:**
    - "Does the student have proof for RPL (Recognition of Prior Learning) / Credit Exemption?"
    - "Is the student transferring from another Australian education provider?"
    - "Has the student completed or do they intend to complete the principal course of study prior to commencing a new program?"
  - **"Course Fee" 110160 AUD:** this looks like a total. The Abertay application showed the annual fee (17950) in the same field, so the field's meaning differs by institution.
  - **"ASSESSMENT REQUIREMENT" is much richer for CQUniversity:**
    - An **"Application Required Documents"** item lists 6 documents, each tagged "Pre-Lodgement Required":
      1. Passport
      2. Official transcripts and Completion Certificate of all Previous Qualifications
      3. English Proficiency Proof
      4. Statement of Purpose / Personal Statement
      5. CV
      6. Work Related Reference from Employer
    - Other items are tagged "Pre-Payment Required" (VFC Agent Form, Statement Of Purpose, Funds Requirements), "Pre-Offer Required" (Pre-Offer Interview) and "Pre-CoE Required" (Financial Verification Matrix).
    - This is the closest thing to a real document checklist in the portal, but it is **text only and not linked to uploads**.
  - **Stale or irrelevant content:**
    - The Financial item for this Bangladesh student says "Financial Covering letter - Srilanka needs to be provided".
    - The Funds item still refers to applications "not filed before 10 May 2024".

### 2.5 Documents (counsellor)
- **Application-level upload:** Application → Documents → kebab ("Add Record", "Download All Documents", "Delete Record" (disabled)) → "Upload Documents" modal.
  - Same drop zone, plus Category* / Sub Category*. Passport sits under "Personal".
  - Result: "Successfully uploaded document(s)."
- **The document is stored at application level:**
  - Its Type is **"Enrolment Course (Application)"**, not "Enrolment" as in the wizard.
  - The enrolment's Documents tab shows it too.
  - So documents can live at two levels (enrolment or application), and the user isn't told which to use.

### 2.6 My Enrolments (`/manage-enrolments`)
- **Buckets:** "1 In Process", "0 Acceptance", "0 Commenced", "0 Not Proceeding". Only the counsellor's own records.
- **The new enrolment's row:**
  - Badge "1/0" (one primary application).
  - **No "$" button**, which the Branch Admin sees.

### 2.7 My Applications (`/manage-enrolment-course`)
- **"No Record Found." / "out of 0 items"**, even though the enrolment list shows this counsellor has 1 application (A00175350).
- This is the **third** login where newly created applications don't appear in this list.

### 2.8 Course Search
- **Same form.** "Where is the student?" is pre-filled "Bangladesh".
- **Search:** "CQUniversity" + "Information Technology" gave "We have 35 Courses from 1 Institution".
  - The first results were "Associate Degree of Information Technology", so it is substring matching, not ranked by relevance.
- **Results:** no error popup, and the **"$" icon is hidden** for counsellors. Heart and "Apply" still do nothing.
- **"View in Institution" is mislabelled:** in card view it opens the **university's public website** in a new tab (e.g. cqu.edu.au), not the institution page in the portal, which counsellors can't access anyway.

### 2.9 My To Do (`/case`)
- **"No Record Found."** Counsellors have no cases. The new Offer case belongs to GSP.

### 2.10 My Inbox
- Inbox "No Record Found." No compose button.

### 2.11 Notifications
- **No notification arrived for this counsellor** after creating the application. The bell had no badge.
- The Branch Admin did receive one ("New Application: … created for …") for the same action in the wizard.

### 2.12 Dashboard (`/dashboard`)
- **Same three dashboards** (including "Test ui"), scoped to the counsellor's own records.
- **"RP - Awaiting Action":** all widgets 0, "No Record Found" (Application / GTE / COE / VISA Follow-up).
- **"RP Pipeline":**
  - "CY App Submitted by Status", **"Pipeline by Intake"** and "Cases Awaiting Response" all show red **"Cannot generate chart at the moment." "No Record Found."**
  - "Pipeline by Intake" should show 1 application; empty data is presented as an error.
  - "RP To Do Case List": 0.
  - **"GSP To Do Case List": 1** (E00102513 / C00303199, Offer, Register, Assigned User blank).
  - "Awaiting Institution Case List": 0.
  - **So "waiting on GSP" is visible here, but nothing on the application record says so.**

### 2.13 Channel Partners → own agency
- **List:** one card "Unilink Global Solution" with **agency-wide** counts (260 / 145 / 9 / 154). This counsellor's own lists show 1.
- **Record:**
  - Counts 262 / 145 / 9 / 154; tabs Company | Branches | History; right Notes | Contact.
  - **"Commission %" is hidden** for counsellors ("GST %" follows directly after "Name of gov't department or licensing body").
  - **GSP staff notes about the agency are visible** to counsellors (e.g. "I spoke with RP, and he will register for the meeting this week…").

### 2.14 Contact List and OSHC Policies (gear)
- **Contact List → Student:** "No Record Found." although the counsellor just created a student with an emergency contact.
- **OSHC List:** "No Record Found." The toolbar still shows add, columns, CSV and filter.

### 2.15 Accommodation, Health Cover, Help, Events, Profile
- Same as the Branch Admin and admin views.

---

## 3. Main flows, step by step (counsellor)

| Flow | Path | Approx. interactions | Notes |
|---|---|---|---|
| Create student (non-wizard) | My Students → kebab → Add Record → 18 required fields → Submit | ~45 | 3 single-option pickers not pre-filled; future DOB accepted |
| Create enrolment | Student → Enrolment panel kebab → Add Record → 7 required (institution and campus manual) | ~16 | Starts at stage "New"; no institution or course guidance |
| Create application | Enrolment → Applications tab → kebab → Add Record → 6 required | ~16 | Campus not carried over; "Type of Student" only on this path; page stays dimmed after success |
| Upload document | Application → Documents → kebab → Add Record → file → Category → Sub Category → Upload | ~7 | Stored as "Enrolment Course (Application)" |
| See status / next step | Enrolments list → record → Cases, or Dashboard → gear → RP Pipeline | ~5 | "Waiting on GSP" only in the dashboard |
| Commission | Not available | – | Tile hidden; URL denied; "$" hidden |

**Non-wizard total:** about 84 interactions for student, enrolment, application and one document. The wizard needed about 80, so the two paths take similar effort but use **different forms and different rules** ("Type of Student", campus carry-over, success messages, document level).

---

## 4. Top 15 UX problems (ranked by harm to a busy counsellor)

1. **The new application is missing from "My Applications"** (0 items), while My Enrolments shows it. This now happens for all three roles.
2. **The page stays dimmed and frozen after "Successfully Created Application"** until it is reloaded.
3. **Nothing on the record says who acts next.** "GSP To Do Case List: 1" appears only in Dashboard → RP Pipeline, and My To Do is empty.
4. **The duplicate-email check hides the owner.** "Email already exists. Please try another email address." pushes the counsellor to create a duplicate student under a different email.
5. **Three required pickers with a single option each are not pre-filled** (partner, branch, counsellor), and the counsellor's display name is the same as the Branch Admin's.
6. **Two ways to create an application use different forms:**
   - "Type of Student" exists only on the non-wizard path.
   - Campus is not carried over on that path.
   - Territory warnings appear on one route for one institution only.
7. **Charts show errors instead of data:** "Pipeline by Intake" and others say "Cannot generate chart at the moment." even with 1 application.
8. **Documents can be stored at enrolment level or application level** with no guidance, so the same passport may be needed twice.
9. **The document checklist exists only as text** (CQUniversity's "Application Required Documents") and is not linked to uploads or progress. Some content is stale or meant for another country ("Srilanka", "10 May 2024").
10. **Weak date validation:** a future date of birth (10-Nov-2026) was accepted.
11. **Inconsistent feedback:**
    - "Successfully Created a Student." on one path, nothing on the wizard.
    - No notification for the counsellor's own new application, though the Branch Admin gets one.
12. **Permission-denied pages are a dead end:** "Oops! Permission for this action is denied." with no link back.
13. **"View in Institution" opens the university's public website**, not the institution page its label suggests.
14. **The counsellor sees agency-wide counts and GSP staff notes** on the partner profile, while their own lists are scoped to one person.
15. **"Course Fee" means different things** on different applications (annual fee for Abertay 17950, total for CQUniversity 110160).

---

## 5. Limitations and missing features (counsellor)

- **No commission visibility at all.** Whether counsellors should see it is a product decision, but there is no explanation.
- **No institution profiles.** A counsellor can't see an institution's entry requirements or territory rules except through course search.
- **No personal task list** of documents to upload or questions to answer.
- **No way to reassign or claim a student** found through the duplicate-email check.
- **No export.**
- **Not checked:**
  - Live capture and the QR self-registration flow
  - Delete actions
  - Later application stages
  - Mobile layout (assumed the same as the Branch Admin view; not re-tested for this role)

---

## 6. Anything broken (counsellor login)

| # | What I did | What happened |
|---|---|---|
| 1 | Clicked OK on "Successfully Created Application" | Grey overlay stayed; page unclickable until reload |
| 2 | Opened My Applications after creating A00175350 | "No Record Found." / "out of 0 items" |
| 3 | Opened Dashboard → "RP Pipeline" | "CY App Submitted by Status", "Pipeline by Intake" and "Cases Awaiting Response": "Cannot generate chart at the moment." |
| 4 | My Students with no records | Two empty-state messages on one page ("No Record Found." and "No Records Found") |
| 5 | Selected a future DOB | Accepted and saved (10-Nov-2026) |
| 6 | Created an application | No notification for this user |
| 7 | Contact List → Student | "No Record Found." despite a new student with an emergency contact |
| 8 | Typed `/manage-commission-transaction` and `/manage-institutions` | "Oops! Permission for this action is denied." (expected, but a dead end) |

---

## 7. What works well and should be kept

- **Clear role scoping:** the counsellor sees only their own students, enrolments and applications, and commission data is hidden from them in course search, records and the partner profile.
- **Duplicate-email detection** exists. Show who owns the record instead of asking for a different email.
- **"Successfully Created a Student."** and "Successfully Created Application" give clear confirmations. Use them on every path.
- **Institution-specific questions** (RPL, transfer, principal course) and a **staged document checklist** for CQUniversity ("Pre-Lodgement Required", "Pre-Payment Required", "Pre-Offer Required", "Pre-CoE Required"). This is a strong model for GSP 3.0 if it is linked to uploads and progress.
- **Commission transactions created automatically** when institution data is complete (CQUniversity).
- **"GSP To Do" vs "RP To Do" lists** already separate responsibility. Bring them onto the student and application pages.
- **Hiding the "$" commission icon** in course search for counsellors.
