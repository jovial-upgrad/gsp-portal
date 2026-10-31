# GSP Legacy Portal (staging) – UX Audit, Agency "BOA" (Branch Admin) view

**Environment:** https://stage-legacy-gsp-portal.upgrad.dev/
**Date of audit:** 25 Oct 2026
**Viewport:** 1054×732 (desktop), ~407 px wide (mobile check)
**Companion report:** `GSP_legacy_portal_UX_audit.md` (GSP Staff / Admin view). Where a screen behaves the same as in the admin view, this report says so and gives only the differences. Page-level details for identical screens are in the companion report.

**Test data created with this login:**
- Student 128812 "Test Student BOA QA" (test.student.boa.qa@example.com, fake passport "TESTQA0001")
- Enrolment E00102512
- Application A00175349 (Abertay University, BA (Hons) Accounting and Finance)
- One dummy PDF
- One enrolment note: "QA test note from agency (BOA) - UX audit, please ignore."

**Not done:** nothing was deleted, no "Mention" was used, and no email, live-capture request, QR download or "Contact Admission" request was sent.

---

## 1. Login, role and navigation map

### Logged-in user (from "My Profile")

| Field | Value |
|---|---|
| Name | "Jovial" "Unilink" |
| Email | jovial.lejo+BOA@upgrad.com |
| User ID | 128719 |
| "User Type" | "Recruitment Partner" |
| "Permission Role" | "Branch Admin" |
| "User Status" | "Has Portal Access" |
| "Job Title" | "BOA" |

- Agency: "Unilink Global Solution", branch "Dhaka Office", BDM "Tokee Tahmid".
- The agency's logo thumbnail appears at the far right of the header. Clicking it does nothing.

### Navigation map

**Home** (`/home`) shows the **same 15 tiles with the same links** as the admin view:

- Course Search → `/course/search`
- My Students → `/manage-students`
- My Enrolments → `/manage-enrolments`
- My Applications → `/manage-enrolment-course`
- My Commission → `/manage-commission-transaction` (header "MY TRANSACTIONS")
- Institutions → `/manage-institutions`
- Channel Partners → `/recruitment-partners` (shows only the agency's own record)
- My To Do → `/case` (header "MY CASE")
- My Inbox → `/emails`
- My Events → `/my-events`
- Dashboard → `/dashboard`
- GSP Academy (external; not audited)
- Accommodation → `/accommodation`
- Health Cover → `/oshc/get-quote`
- Internships (external; not audited)

**Header:**

- "?" Help menu: "Contact Admission", "Contact Commission", "Contact System Admin"
- Gear menu (**reduced for this role**):
  - "Contact List" → `/contacts`
  - "OSHC Policies" → `/oshc/`
- Megaphone: "Announcements" panel, which shows "No Announcements"
- Bell: "Notifications" panel. It showed "No Notification" at first, then a badge "1" after the application was created.
- Avatar menu: "Update Profile Image", "My Profile", "Logout"

**My Profile** (`/my-profile`) has tabs "My Profile", "Email", "Notification Alert Channel", "Announcement", and an **extra "Student QR" tab**.
- The "Student QR" tab is cut off at the right edge and needs sideways scrolling to reach.
- It shows a "Student Registration QR Code" with "Copy" and "Download" buttons.

### What this role can and cannot do, compared with admin

| Area | Admin | BOA (agency) |
|---|---|---|
| Data scope | All agencies (84,092 students) | Own agency only (440 students, 858 applications) |
| Settings (gear) | 11 admin pages | "Contact List" and "OSHC Policies" only |
| Enrolments kebab | Add Record, Assign BDM, Delete, Sort, Advanced Search | Delete (disabled), Sort, Advanced Search |
| Institutions list | App counts and commission % chips | No app counts, no commission % |
| Dashboards | About 230 staff reports | "RP - Awaiting Action", "RP Pipeline", "Test ui" |
| Note "Private" checkbox | Available | Disabled |
| Course search error popup ("Institution not found…") | Appears every time | Did not appear |

---

## 2. Page-by-page findings

### 2.1 Home
- **Same as admin.**
- **Problem:** no counts, tasks or alerts on the landing page. This matters more for an agency user, because their real "to-do" lists are hidden inside the Dashboard (see 2.11).

### 2.2 My Profile → "Student QR"
- **Purpose:** gives the agency a QR code that students can scan to register themselves.
- **Layout:** "Student Registration QR Code", the QR image, "Copy" and "Download".
- **UX problems:**
  - This useful feature is hidden as the fifth tab of the profile page, off-screen at 1054 px.
  - Nothing explains what happens after a student scans it.
- **Not tested:** the QR flow itself.

### 2.3 Course Search
- **Same form as admin** (17 optional inputs, Enter does not submit, "Refine search" / "View search result" interstitial, not fuzzy). Differences:
- **"Where is the student?" is pre-filled with "Bangladesh"** (the agency's country). It has a reset icon, and the value comes back every time you click "Refine search".
- **Results are silently filtered by territory:**
  - With "Bangladesh" set, searching "Abertay" (alone or with "comput") returned "Sorry no matching course found..".
  - After clearing the location, the same search returned "We have 183 Courses from 1 Institution".
  - Nothing tells the agency that courses were hidden because of territory rules.
- **Clearing the location lets you apply to restricted courses.** I applied to "BA (Hons) Accounting and Finance" and only learned in the wizard that it was "Territory NOT ALLOWED". So the agency either sees nothing, with no reason, or sees the course and finds out about the restriction later.
- **No error popup:** results loaded **without** the "Institution not found for the selected Course !!" popup that the admin login always saw.
- **Same as admin:**
  - "$" on a result row → "No matched commission item".
  - Heart (tooltip "Select Course") does nothing visible; the counter stays "0" and "Apply" stays grey.
  - The course name is not clickable.
  - Card view has "Checklist", "View in Institution" and "Apply Now".

### 2.4 Enrolment Wizard (agency)
- **Step 1 – Student**
  - "Select Student:" lists only this agency's students, e.g. "92923 - . MD MOTTAKIN HAQUE". Duplicate names appear with different IDs ("Abdul Aual Shakib" twice).
  - "Add New Student" opens the **same 44-field form, with 18 required fields**, as admin. Differences:
    - "Recruitment Partner*" is **not pre-filled**, although the only option is "Unilink Global Solution".
    - "RP Branch*" is not pre-filled, although the only option is "Dhaka Office".
    - "Counsellor*" lists **"Jovial Unilink" twice** (two identical entries) and "Md Nazmul Hasan".
    - The agency therefore spends about 6 clicks choosing values the system already knows.
  - DOB again cannot be typed. Reaching 2003 took 7 clicks.
  - **An expired passport is accepted:** "Date of Expiry" 01-Oct-2026 (before today) was saved with no warning.
  - **Dropdown search remembers old text:** reopening the address "Country" dropdown kept the previous search ("Bangladesh"), so typing "Bangla" became "BangladeshBangla" → "No Record Found". You have to clear it by hand.
  - **No confirmation:** student creation shows no success message.
- **Step 2 – Enrolment**
  - Same 21-field modal (Application Current Country*, "Is the student at the destination?*", Commencement Year* pre-filled "2026", Commencement Month*, …).
- **Step 3 – Application**
  - **Territory warning:** the same yellow "WARNING:" modal ("The selected Course is currently not available for the applicant's current location … 6-8 weeks …") and red "Territory NOT ALLOWED".
  - "Confirm & Create" is greyed out until Commencement Date and Application Type are set (via the edit pencil). There is no hint that the pencil is where to set them.
  - **Internal error shown to the agency:** after Confirm & Create, the agency sees "Successful Created Multiple Applications." (only one was created) and "BA (Hons) Accounting and Finance: Failed to create Estimate Commission. We have informed GSP Commmisson Team." (typo in the original).
- **Step 4 – Documents**
  - Same generic drop zone.
  - Category options include internal ones such as "Commission", "Income" and "Fund"; Passport sits under "Personal".
  - After upload the agency sees a "Verify Document" button.
  - "Successfully finish the enrolment wizard!", then the enrolment record opens.
- **Data bug reproduced:** "I Have Worked After My Studies" was saved as "Yes", although the question was never answered.
- **Notification:** the bell then showed "A00175349 New Application: A00175349 created for Test Student BOA QA - Abertay University 25-Oct-2026 10:44".

### 2.5 Enrolment record (`/manage-enrolments/view/E00102512`)
- **Same layout as admin:**
  - Header and the 9-stage tracker.
  - Left tabs: Enrolment | Documents | History | Cases | Commission | Events | Applications. "Applications" is cut off at this width.
  - Right tabs: Student | Notes | Announcements.
- **Icons:** watch, **delete (trash)** and edit are all visible to the agency. Delete was not tested.
- **Cases tab:** the agency can see internal cases:
  - C00303198 "OFFER 128812 A00175349 Aberta…" (Offer / Register)
  - C00303197 "A00175349 Error Creating Commi…" (Commission / Investigate)
- **Commission case C00303197, as the agency sees it:**
  - Name "A00175349 Error Creating Commission"
  - Description "Matching Institution Commission Item not found - Instituition/Sector/Date Range" (internal text, with a typo)
  - **Owner "Jovial Unilink", i.e. the agency user**, while "Assigned Queue" is "Commission Team"
  - Read-only (watch icon only)
- **Notes → "Add Record"** ("Enrolment > Notes")
  - Category* options for the agency: Application, BDM Request, COE, CohortGo, Commission, Deferral, Enrol, GSP Requests, GTE, Invoice, IP Requests, Lead Follow-up, Offer, Payment, RP Requests, Special Condition, Study Background, VISA, Withdrawal, General, Assessment Checklist, Student Service.
  - Then Sub Category and Notes.
  - "Private" checkbox: **disabled** for the agency.
  - "Mention": a checkbox list of **all GSP users in alphabetical order** ("Aarohi Hadole", "admin users", "Akshay Puri - Stage", …) with no team or role, so the agency must guess whom to tag.
  - The created note shows "Mentioned: NA". There is no reply or thread.
- **An older enrolment** (E00094724, "Acceptance" bucket):
  - Status "COE Issued"; the tracker sits at "Visa"; milestone dates stop in Oct 2024; Notes "No Records Found".
  - Its VISA case C00300927 shows **"Case Status: Awaiting RP"**, Case Stage "Initiation", Assigned Queue "Bangladesh Admission", opened 18-Oct-2024.
  - Description, Notes, Task and Email are all empty.
  - **The agency is being waited on, but nothing says what for.** The status is only visible three clicks deep inside a case.

### 2.6 Application record (`/manage-enrolment-course/view/A00175349`)
- **Same fields as admin**, including "External Reference" = "Territory NOT ALLOWED" and "Tentative Course Completion Date" 06-Sep-2030.
- **"ASSESSMENT REQUIREMENT":** the agency sees only a filter button (no add or delete), plus "RP To Do : 0%" and "GSP To Do : 0%".
  - Items such as "R000796764 UG Business, Management and Commerce Academic Requirements" show "Not started".
  - Nothing links an item to an upload, so the agency can't move "RP To Do" forward from here.

### 2.7 My Students (`/manage-students`)
- **List:** 440 items, all for the agency's own students. Same large cards; about 6 per screen; no status column.
- **Kebab:** Detail View, Add Record, Delete Record (disabled), Sort Records, Advanced Search. **No export.**
- **Opening a record:** you still have to click the ID or avatar; the name is not a link.

### 2.8 My Enrolments (`/manage-enrolments`)
- **Buckets:** "266 In Process", "103 Acceptance", "9 Commenced", "154 Not Proceeding".
- **Kebab:** Detail View, Delete Record (disabled), Sort Records, Advanced Search. **No Add Record and no export.**
- **Numbers on the tracker dots** (e.g. 0, 3, 0, 2, 20, 8) are day counts. Their meaning only shows on hover, e.g. "Count of Days from Application Lodged Date to Letter of Offer Issued Date".
- **Bucket names don't match the tracker:** the "Acceptance" bucket contained rows whose status is "COE Issued" and whose tracker is at "Visa".
- **Odd combinations:** "Deferred" status appears while the stage is still "Pre-Screening".
- **The same total is shown three ways:** the agency's in-process count is "266" here, "260" on the Channel Partners card and "261" on the partner record.

### 2.9 My Applications (`/manage-enrolment-course`)
- **List:** 858 items. Kebab: Show / Hide Columns, Advanced Search, Filter Columns. **No export.**
- **Search problem reproduced:** "A00175349", created about 15 minutes earlier, returned "No Record Found". The agency cannot find the application it just created.

### 2.10 My Commission (`/manage-commission-transaction`, header "MY TRANSACTIONS")
- **Buckets:** "192 Estimate", "177 In Process", "8 Paid". All rows are "Agency Charge" / "Course Commission", mostly "Confirmed".
- **List problems:**
  - The "Agency" column is empty, even for an agency user.
  - The amount appears only in the "Ex GST" column at the far right, after about 18 columns of sideways scrolling.
  - Kebab offers Show / Hide Columns, Advanced Search and Filter Columns. **No export.**
- **Transaction item T00297422:**
  - Transaction Date "04/Jul/2025", Due "03/Aug/2025", Status "Confirmed".
  - **"Days to Due Date" -448:** more than a year overdue, with no explanation.
  - Course Fee 13140 AUD, Ex GST Amount 1379.7, GST Amount 0.
  - The agency also sees internal fields: "Is Exported", "Lock AUD", "Write Off", "SRP AUD", and "Created By" staff names.
  - The Documents tab did not open when clicked.
- **Transaction C00235336:**
  - "Agency Charge", Total Tran Course Fee 26280 AUD, **"Commission %" 70**, "GST %" blank, Total Ex GST 2759.4.
  - 2759.4 is 10.5% of the fee, so the institution's base rate (implied 15%) is never shown.
  - Course shown as "cid-mm-01-21799" (a code, not a course name).
- **No invoice** document was found.

### 2.11 Dashboard (`/dashboard`) – the agency's real work queue
- **Loading:** the page shows a blank teal canvas for about 8 s, then "DASHBOARD > RP - AWAITING ACTION".
- **Dashboard selector** (behind the gear): "RP - Awaiting Action", "RP Pipeline", "Test ui" (a test dashboard visible to agencies). The toolbar has pin, print and refresh only.
- **"RP - Awaiting Action" widgets:**
  - "Application Follow-Up": badge **31**, but the footer says "out of **34** items"
  - "GTE Follow-up": badge **61**, footer "out of **63** items"
  - "COE Follow-up": 11
  - "VISA Follow-up": 13
  - "Enrolment Awaiting Submission": **0, "No Record Found"**, although the new incomplete E00102512 exists
  - "Expired Enrolment": 0
  - Column headers are truncated ("Enr A…", "Enr St…", "Enrol…" with tooltip "Enrolment ID", "Case …").
  - Rows show branch, student, enrolment link, case stage (Assessment, Offer Follow-up, Initiation, Deposit, COE Request), BDM and case link.
- **"RP Pipeline" widgets:**
  - "CY App Submitted by Status" shows red text: **"Cannot generate chart at the moment." "No Record Found."**
  - "Pipeline by Intake" (201): stacked by stage.
  - "Cases Awaiting Response" (207): by month, stacked by case stage (Lodgement, Initiation, Assessment, Offer Follow-up, Deposit, COE Request, Verify Documents, Documents Prep).
  - **"RP To Do Case List" (207)**: Enrolment ID, Case Type, Case Stage, Enr Student…, Case ID, App ID, GSP SID, Enr Comme…, Re…
  - **"GSP To Do Case List" (34)**: includes the new E00102512 / C00303198 (Offer / Register) with **Assigned User blank**. The others show GSP staff and Response Dates from Oct 2024.
  - **"Awaiting Institution Case List" (24)**.
- **Key finding:** the split of who must act next (agency, GSP or institution) **does exist**, but only here, behind Dashboard → gear → dropdown → "RP Pipeline". It is not on the enrolment or application records, and not in "My To Do".

### 2.12 My To Do (`/case`, header "MY CASE")
- **Only 1 item:** the internal "A00175349 Error Creating Commi…" commission case (owner "Jovial Unilink").
- **The agency's 207 real to-dos are missing:** cases such as the VISA case "Awaiting RP" do not appear, because GSP staff own them.

### 2.13 My Inbox (`/emails`)
- **Contents:** "Inbox" and "Sent" both show "No Record Found."
- **Controls:** the Inbox / Sent / Draft / Archive toggles have the tooltip "Hold down [Ctrl or Cmd] key for multi select". There is no compose button.
- **Case emails:** inside a case, the Email kebab opens an empty pop-over.
- **What this means:** the agency has no visible email channel with GSP in the portal.

### 2.14 My Events
- Same as admin: an empty week calendar, with the "Week" button cut off at the right edge.

### 2.15 Institutions (`/manage-institutions`)
- **List:** the same 1,013 institutions, but **without** the "Apps In Process" counts and **without commission % chips**. Only study-level labels (Postgraduate, Undergraduate, VET, English) are shown.
- **Not tested:** the institution record pages.

### 2.16 Channel Partners → own agency (`/recruitment-partners/view/14053`)
- **List:** one card, "Unilink Global Solution", with counts 260 / 145 / 9 / 154 and the onboarding tracker ("New" > "Initial Registration" > "Due Diligence" > "GSP Approval" > "Registered").
- **Record:**
  - Tabs: Company | Branches | History; right: Notes | Contact.
  - Fields include "Commission %" 70, "GST %", Stage "Registered", Status "Approved" and Status Reason "Application approved after DD".
  - **The Notes panel shows GSP staff's internal notes about this agency**, e.g. "I spoke with RP, and he will register for the meeting this week…", category "Training". Internal staff notes appear to be visible to the agency itself.
- **Rate visibility:** this is the only place where the agency can see its own commission rate.

### 2.17 Contact List (gear → `/contacts`)
- Tabs: Student | RP | Institution | Institution Partner.
- **Student tab is empty** ("No Record Found."), although the agency has 440 students and I had just added an emergency contact.

### 2.18 OSHC Policies (gear → `/oshc/`, "OSHC LIST")
- **Contents:** 1 policy (NIB, CQUniversity Australia).
- **Toolbar:** add, columns, **CSV export** and filter. Export exists here but not on students, enrolments, applications or commission.

### 2.19 Accommodation, Health Cover, Help → Contact Admission
- Same as the admin view: the embedded "amber" housing search; the OSHC quote form ("The Policy Finish Date field is required" against an "End Date" label); and a free-text "Contact Admission" modal with no way to link a student. Not submitted.

---

## 3. Main flows, step by step (agency)

| Flow | Path | Approx. interactions | Notes |
|---|---|---|---|
| Find a course | Course Search → (clear default location) → type university / course → Search Courses → View search result | ~6 | With the default location set, restricted courses vanish with no reason |
| Create student | Apply Now → Add New Student → 18 required fields | ~45 | Partner, branch and counsellor not pre-filled; counsellor listed twice; DOB 7 clicks |
| Create enrolment | 7 required (4 pre-filled) | ~10 | Year pre-filled to the wrong year (2026 vs 2027 intakes) |
| Create application | Agree to warning → edit pencil → date (5 clicks) → type → Update → Confirm & Create | ~12 | Internal commission error shown |
| Upload document | Drop file → Category → Sub Category → Upload → Finish | ~6 | No required-documents list |
| Find what to do next | Dashboard → gear → dropdown → "RP Pipeline" → scroll to "RP To Do Case List" | ~5 + 8 s load | "My To Do" shows the wrong list (1 internal case) |
| See why a case waits on you | Enrolments → record → Cases → case → read "Case Status" | ~5 | "Awaiting RP" with no description, note or task |
| Check commission | My Commission → scroll ~18 columns → open item → open transaction | ~4 + scrolling | Rate visible only as "Commission %" 70 on transaction or partner profile; no invoice |

**Total from course to finished wizard:** about 80 interactions, the same as the admin view, plus about 6 extra clicks to choose the agency's own partner and branch.

---

## 4. Top 15 UX problems (ranked by harm to a busy agency counsellor)

1. **The agency's real to-do list is hidden in the Dashboard.**
   - The "RP To Do Case List" (207) and "Awaiting RP" statuses live in Dashboard → gear → "RP Pipeline".
   - "My To Do" shows only 1 internal commission case.
2. **"Awaiting RP" has no reason.**
   - Example: VISA case C00300927 has waited since Oct 2024 with an empty description, notes, tasks and email.
   - Nothing appears on the enrolment list or the record header.
3. **The just-created application can't be found** in My Applications (search by ID returns "No Record Found").
4. **Territory restrictions are silent or late.**
   - With the default student location, restricted courses disappear with "Sorry no matching course found..".
   - Without it, the agency can build a full student and enrolment before seeing "Territory NOT ALLOWED".
5. **The student form doesn't use what the system knows.**
   - The only possible Recruitment Partner and RP Branch are not pre-filled.
   - The counsellor appears twice.
   - 18 required fields; DOB takes 7 clicks.
6. **Internal and staff content is exposed to the agency:**
   - "Failed to create Estimate Commission. We have informed GSP Commmisson Team."
   - A "Commission Team" error case owned by the agency user
   - GSP staff notes about the agency on its partner profile
   - Fields such as "Is Exported", "Lock AUD", "Write Off"
   - A dashboard named "Test ui"
7. **No way to talk to GSP about a specific student, other than a note.**
   - The inbox is empty, there is no compose button, and "Contact Admission" can't be linked to a student.
   - Notes can't be private and have no replies.
   - "Mention" lists every staff member alphabetically with no role.
8. **Commission is unclear.**
   - "Commission %" 70 is shown with no base rate.
   - The amount is buried at the far right of the list.
   - "Days to Due Date" -448 is unexplained.
   - Courses are shown as codes ("cid-mm-01-21799").
   - No invoice.
9. **Dashboard counts disagree with their own lists:** 31 vs 34, 61 vs 63, and "Enrolment Awaiting Submission" 0 while an incomplete enrolment exists. The "CY App Submitted by Status" chart fails ("Cannot generate chart at the moment.").
10. **The same total appears as 266, 260 and 261** in different places (agency in-process enrolments).
11. **No document checklist** in the wizard. The "RP To Do" requirement items on applications are text only and can't be completed from there.
12. **The shortlist (heart) and "Apply" buttons in course results don't work,** so multi-course applying from search is not possible.
13. **Tracker numbers and bucket names confuse:**
    - Day counts appear without labels (hover only).
    - The "Acceptance" bucket holds items at the "Visa" stage with status "COE Issued".
14. **No export** for students, enrolments, applications or commission (only OSHC has CSV).
15. **Weak validation:**
    - An expired passport is accepted.
    - "Worked after studies" is saved as "Yes" without an answer.
    - Dropdown search keeps stale text, which leads to "No Record Found".

---

## 5. Limitations and missing features (agency)

- **A "who acts next" summary** on each student, enrolment and application. The data exists in cases but isn't surfaced.
- **A single task inbox** combining "RP To Do" cases, missing documents and expiring items.
- **Two-way, per-student messaging** with GSP admissions, with visible replies and response times.
- **Commission:** a plain "you earn X (Y% of institution commission)", expected payment date, overdue reasons, and invoice download.
- **Course search:** visible territory eligibility for the student's country, saved shortlists, and a working multi-course apply.
- **Documents:** required-documents checklist per course, expiry tracking (e.g. passport), and reuse across enrolments. Reuse was not verified.
- **Exports** for the agency's own pipeline.
- **The Student QR self-registration** feature is hard to find and unexplained.
- **Not checked:**
  - What a student sees after scanning the QR
  - Deleting an enrolment
  - Institution record pages as an agency
  - Notifications for status changes (none happened)
  - Email to or from GSP (none existed)
  - GSP Academy and Internships (external)

---

## 6. Anything broken (agency login)

| # | What I did | What happened |
|---|---|---|
| 1 | Searched My Applications for the new A00175349 | "No Record Found" |
| 2 | Opened Dashboard → "RP Pipeline" | "CY App Submitted by Status": "Cannot generate chart at the moment." "No Record Found." |
| 3 | Compared dashboard badges with their lists | 31 vs "out of 34 items"; 61 vs "out of 63 items"; "Enrolment Awaiting Submission" 0 despite an incomplete enrolment |
| 4 | Clicked heart on course results | No change; counter "0"; "Apply" stays grey |
| 5 | Clicked "$" on a course result | "No matched commission item" |
| 6 | Created a student without answering the work question | Saved "I Have Worked After My Studies: Yes" |
| 7 | Reopened a searchable dropdown | Previous search text kept ("BangladeshBangla"), then "No Record Found" |
| 8 | Confirm & Create (1 application) | "Successful Created Multiple Applications." + internal commission failure message |
| 9 | Opened the Email kebab in a case | Empty pop-over |
| 10 | Opened Contact List → Student | "No Record Found." despite 440 students |
| 11 | Clicked the Documents tab on a transaction item | Tab did not switch |
| 12 | Dashboard first load | Blank teal canvas for about 8 s before widgets appear |
| 13 | Mobile (~407 px) | Enrolment status bucket tabs disappear; dashboard tables truncate every column to 1–2 letters |

---

## 7. What works well and should be kept

- **The data needed for "who acts next" already exists:**
  - Case statuses like "Awaiting RP"
  - The "RP To Do", "GSP To Do" and "Awaiting Institution" case lists
  - "RP To Do %" / "GSP To Do %" on applications
  - GSP 3.0 can bring these to the front.
- **"RP - Awaiting Action" grouping** (Application / GTE / COE / VISA follow-up) matches how counsellors think about work.
- **Data scoping:** the agency sees only its own students, enrolments, applications and commission.
- **Default student location** from the agency's country. It needs an explanation when it hides courses.
- **Status buckets with counts** on enrolments and commission ("Estimate", "In Process", "Paid").
- **Day counts on the tracker** ("Count of Days from Application Lodged Date to Letter of Offer Issued Date"). Worth keeping, with visible labels.
- **Student self-registration QR.** Worth promoting.
- **Proper empty states** in the agency's Notifications and Announcements panels ("No Notification", "No Announcements").
- **The plain-language territory warning** with time impact ("6-8 weeks"). Move it into search.
