# GSP Legacy Portal (staging) – UX Audit, Agency Head Office Admin ("HOA", RP Head) view

**Environment:** https://stage-legacy-gsp-portal.upgrad.dev/
**Date of audit:** 25 Oct 2026
**Viewport:** 1054×732 (desktop)

**Companion reports:**
- `GSP_legacy_portal_UX_audit.md`: GSP Admin
- `GSP_legacy_portal_UX_audit_BOA_agency_view.md`: Branch Admin
- `GSP_legacy_portal_UX_audit_COU_counsellor_view.md`: Counsellor

Screens identical to those reports are summarised. This report concentrates on what the agency head can see and do that the other roles can't.

**Approach:** the student, enrolment and application forms were already tested end to end three times and behave the same here. So I opened them only to check the role-specific pickers (branch and counsellor) and cancelled. **No new student, enrolment or application was created with this login.** Nothing was deleted or edited, and "Reset Password", "Add Record" (branch or user) and "Sync" were not clicked.

---

## 1. Login, role and navigation map

### Logged-in user (from "My Profile")

| Field | Value |
|---|---|
| Name | "Jovial" "**Unlink**" (spelled differently from the agency name "Unilink") |
| Email | jovial.lejo+HOA@upgrad.com |
| User ID | 128718 |
| "User Type" | "Recruitment Partner" |
| "Permission Role" | **"Head Office Admin"** |
| "User Status" | "Has Portal Access" |
| "Job Title" | "HOA" |

### Navigation map

**Home: 15 tiles**, the same as Admin and Branch Admin:

- Course Search
- My Students
- My Enrolments
- My Applications
- My Commission ("MY TRANSACTIONS")
- Institutions
- Channel Partners
- My To Do ("MY CASE")
- My Inbox
- My Events
- Dashboard
- GSP Academy (external)
- Accommodation
- Health Cover
- Internships (external)

**Header:**
- "?" Help: "Contact Admission", "Contact Commission", "Contact System Admin"
- Gear: "Contact List", "OSHC Policies"
- Megaphone, Bell (no badge during the session)
- Avatar: "Update Profile Image", "My Profile", "Logout"

**My Profile tabs:** "My Profile", "Email", "Notification Alert Channel", "Announcement", "Student QR".

### Role comparison (all four audits)

| Area | GSP Admin | HOA (Head Office Admin) | BOA (Branch Admin) | COU (Counsellor) |
|---|---|---|---|---|
| Home tiles | 15 | 15 | 15 | 13 |
| Students | 84,092 | **445** (all branches) | 440 at time of audit (branch) | own only |
| Enrolment buckets (In Process / Acceptance / Commenced / Not Proceeding) | all | **271** / 103 / 9 / 154 | 266 / 103 / 9 / 154 | own |
| Commission buckets (Estimate / In Process / Paid) | all | **196** / 177 / 8 | 192 / 177 / 8 | no access |
| Partner record tabs | Company, Branches, Company Profile, Document, History, Cases | **same as Admin** | Company, Branches, History | Company, Branches, History |
| Branch management | yes | **Add branch; branch edit and delete icons; team list; add user** | no | no |
| RP Branch picker in student form | any partner | **3 branches** | 1 branch | 1 branch |
| Dashboards | ~230 | "RP - Awaiting Action", "RP Pipeline", "Test ui" | same 3 | same 3, own records |

---

## 2. Page-by-page findings

### 2.1 Home and profile
- **Home:** same 15 tiles; no counts or tasks.
- **Profile:** the surname is stored as "Unlink", a likely typo, so the head user's own name doesn't match the agency name.

### 2.2 My Students (`/manage-students`)
- **List:** 445 items across all branches, including students in the Mumbai branch (counsellors "Rachana Kelgandre" and "Rachana RP", Branch BDM "Aarchi Hadole") and both test students created earlier today.
- **Missing context:** there is **no branch column or branch filter** on the list. The only clue is the Branch BDM name, so a head office user can't see the branch breakdown at a glance.
- **Same as other roles:** card layout and kebab (Detail View, Add Record, Delete Record (disabled), Sort Records, Advanced Search).

### 2.3 Student form (opened via My Students → Add Record, then cancelled)
- **Same 44 fields, 18 required.**
- **"Recruitment Partner*"** has a single option, "Unilink Global Solution", and is still not pre-filled.
- **"RP Branch*"** offers **"ABCDefg"**, "Dhaka Office" and "Mumbai Office". "ABCDefg" is a test-data branch that the head office sees in a live picker.
- **"Counsellor*"** for Mumbai Office offers "Rachana Kelgandre" and "Rachana RP". This is the only role where choosing a branch and counsellor is a real choice.

### 2.4 My Enrolments (`/manage-enrolments`)
- **Buckets:** "271 In Process", "103 Acceptance", "9 Commenced", "154 Not Proceeding". The Branch Admin saw 266 in process; the difference is the other branches.
- **Rows:** include the Counsellor-created E00102513 and the Branch Admin-created E00102512, each with a "$" button.
- **Kebab:** Detail View, Delete Record (disabled), Sort Records, Advanced Search. **No export and no branch filter.**
- **Enrolment record** (E00102513):
  - Tabs: Enrolment | Documents | History | Cases | **Commission** | Events | Applications. The Commission tab is visible to the head office but not to the counsellor who created the record.
  - **Commission tab:** T00308429, Transaction Date 05-May-2027, Due 04-Jun-2027.

### 2.5 My Applications (`/manage-enrolment-course`)
- **Neither new application can be found by ID:**
  - "A00175349" (created 10:44 by the Branch Admin) → "No Record Found."
  - "A00175350" (created 11:05 by the Counsellor) → "No Record Found."
  - Checked at **11:16**. A00175349 was still missing 32 minutes after creation, so this is not a short sync delay.

### 2.6 My Commission (`/manage-commission-transaction`)
- **Buckets:** "196 Estimate", "177 In Process", "8 Paid". Estimate went up from the Branch Admin's 192 after the counsellor's CQUniversity application auto-created commission.
- **Same grid as the Branch Admin view:** "Agency Charge" rows, "Agency" column empty, amount only in the far-right "Ex GST" column, no export.
- **The new estimate, item T00308429:**
  - Transaction Date "05/May/2027", Due "04/Jun/2027"
  - Sequence 1, Course Fee 110160 AUD
  - Ex GST Amount 3662.82, **Days to Due Date 222**
  - Created By "Jovial Unilink"
- **Its transaction C00262994:**
  - "Agency Charge", Total Tran Course Fee 110160 AUD
  - **"Commission %" 70**, Total Ex GST 3662.82
  - Status "Estimate"
- **How the figure appears to be calculated (not shown in the portal):**
  - 3662.82 matches the annual fee (36,720 AUD) × about 14.25% (implied institution rate) × 70% (agency share).
  - The head of the agency sees only "70", the total course fee and the result.
  - The institution rate, which year is being paid, and why the payment date is 05-May-2027 are not explained.
- **Same internal fields as the Branch Admin view:** "Is Exported", "Lock AUD", "Write Off", "SRP AUD".

### 2.7 Channel Partners → own agency (`/recruitment-partners/view/14053`)
- **Inconsistent counts:**
  - List card: 260 / 145 / 9 / 154
  - Partner record: 262 / 145 / 9 / 154
  - Enrolments bucket: 271 in process
  - Three different "in process" numbers for the same agency.
- **Tabs (same as GSP Admin):** Company | Branches | Company Profile | Document | History | Cases. Right panel: Notes | Contact. GSP staff notes about the agency are visible here too.
- **Branches tab:**
  - Branch ID / Branch Name: 17706 "ABCDefg", 14918 "Dhaka Office", 17713 "Mumbai Office".
  - Kebab offers **"Add Record"** (not clicked).
- **Branch record** (`/rp-branches/view/14918`, breadcrumb "RECRUITMENT PARTNER > RP BRANCH"):
  - Tabs: Branch | History | **Team**. Right panel: Notes | Contacts.
  - **Delete and edit icons** are visible.
  - Uses a **different form layout** (labels to the left of fields, two columns) from every other record page.
  - BRANCH DETAILS: RP ID, Branch ID, RP Name, Branch Name, Branch BDM "Tokee Tahmid".
  - BRANCH ADDRESS: street, city, state, postal code, country.
- **Team tab:**
  - User ID / First Name / Last Name / Permission Role / Email / Branch Name / Created On.
  - Dhaka Office users: the Branch Admin (128719), the Counsellor (128720) and "Md Nazmul Hasan" (62660, **Head Office Admin**, email on yopmail.com).
  - **The HOA user being audited (128718) is not listed under any branch I opened.**
  - Kebab offers **"Add Record"** for new users (not clicked).
- **User record** (128719, breadcrumb "… > RP BRANCH > COUNSELLOR"):
  - The page and tab are titled **"Counsellor"** although the user is a Branch Admin.
  - "User Type" shows **"AGENT"** here but "Recruitment Partner" on the user's own profile.
  - **"Activated" is unticked** while "User Status" says "Has Portal Access".
  - **"Reset Password"** button, plus delete and edit icons (none used).
  - Fields: RP Name, Branch Name, User ID, First Name, Last Name, Phone, Mobile, Job Title, User Type, User Status, Permission Role, Activated, Email, Login Name.

### 2.8 Institutions
- **Same list as the Branch Admin view:** 1,013 institutions, without app counts or commission % chips.

### 2.9 My To Do (`/case`)
- **1 item:** C00303145 "A00175317 Error Creating Commi…" (Commission / Investigate / Not Started), owner **"Jovial Unilink"**. This is an older internal commission-error case, different from the Branch Admin's.
- **Ambiguous owner:** the Branch Admin and the Counsellor both display as "Jovial Unilink", and this user is "Jovial Unlink". You can't tell which person owns the case.
- **Missing work:** none of the agency's "RP To Do" cases (207 in the Branch Admin's dashboard) appear here.

### 2.10 Dashboard
- **Same dashboards** ("RP - Awaiting Action" default, "RP Pipeline", "Test ui"), with the same figures as the Branch Admin: Application Follow-Up 31 (list "out of 34"), GTE 61 ("out of 63"), COE 11, VISA 13.
- **Every visible row is "Dhaka Office".** There is **no branch filter or branch breakdown** for a head office user.
- The VISA widget showed a spinner for several seconds before loading.

### 2.11 Inbox, Events, Accommodation, Health Cover, Contact List, OSHC
- **Same as the Branch Admin view.** Not repeated.

---

## 3. Main flows (head office)

| Flow | Path | Approx. interactions | Notes |
|---|---|---|---|
| Create student | My Students → Add Record → 18 required fields | ~45 | Must choose partner (1 option), branch (3, incl. test "ABCDefg") and counsellor |
| See pipeline by branch | Not possible | – | No branch column or filter on lists or dashboards |
| See agency commission | My Commission → item → transaction | ~4 + scrolling | "Commission %" 70 only; estimate calculation not explained |
| Manage branches | Channel Partners → own record → Branches → branch | ~4 | Add, edit and delete available |
| Manage users | … → branch → Team → user | ~5 | Add user, reset password, delete and edit available; role labels inconsistent |
| Find a new application | My Applications → search ID | 2 | "No Record Found" (not findable) |

---

## 4. Top 15 UX problems (ranked by harm to an agency head)

1. **No branch view anywhere.** Lists and dashboards have no branch column, filter or comparison, although head office oversight is the main purpose of this role.
2. **New applications can't be found** in My Applications, even 32 minutes after creation. This affects all four roles.
3. **Three different totals for the same thing:** "in process" is 260 on the partner card, 262 on the partner record and 271 in Enrolments.
4. **Commission estimates aren't explained.**
   - Only "Commission %" 70, the total course fee and the result are shown.
   - The institution rate, which year is being paid, and the reason for the payment date are not.
   - The amount sits at the far right of the list, and there is no export.
5. **People are indistinguishable.**
   - Branch Admin, Counsellor and Head Office Admin display as "Jovial Unilink" or "Jovial Unlink".
   - Case owners and counsellor pickers can't be told apart.
   - A typo in the head user's own surname.
6. **User administration labels contradict each other:**
   - A Branch Admin's page is titled "Counsellor".
   - "User Type" is "AGENT" on one page and "Recruitment Partner" on another.
   - "Activated" is unticked while "Has Portal Access" is shown.
7. **Destructive actions sit next to normal ones:** delete icons on branch and user records, with no explanation of the consequences (not tested).
8. **Test data in live pickers:** branch "ABCDefg" and the "Test ui" dashboard are visible to the agency head.
9. **"My To Do" shows an internal commission-error case** instead of the agency's real to-dos.
10. **"Waiting on the agency" is still hidden** in the dashboard and inside cases (see the Branch Admin report), with no branch-level roll-up.
11. **Single-option pickers aren't pre-filled** (Recruitment Partner).
12. **The branch and user pages use a different form layout** (labels on the left) from every other record page.
13. **No export** of students, enrolments, applications or commission for head office reporting.
14. **GSP staff's internal notes** about the agency are visible on the partner record.
15. **Dashboard widgets load slowly** (spinners, blank canvas) and their counts disagree with their lists (31 vs 34, 61 vs 63).

---

## 5. Limitations and missing features (head office)

- **Branch-level reporting:** a pipeline by branch, counsellor performance, and a commission split by branch.
- **Team overview:** all users across branches in one list with roles and activation status. The HOA user doesn't appear in the branch team lists I opened.
- **Commission statement for the agency:** a clear rate breakdown (institution % × agency %), a payment schedule, invoices and export.
- **Reassigning students or enrolments** between counsellors or branches: no obvious control was found.
- **Not tested:**
  - Adding branches or users
  - Resetting passwords
  - Deleting
  - The "Company Profile", "Document" and "Cases" tabs on the partner record
  - Mobile layout (assumed the same as the Branch Admin view)

---

## 6. Anything broken (head office login)

| # | What I did | What happened |
|---|---|---|
| 1 | Searched My Applications for A00175349 and A00175350 | "No Record Found." 32 and 11 minutes after creation |
| 2 | Compared agency "in process" counts | 260 (list card), 262 (record), 271 (Enrolments) |
| 3 | Opened a Branch Admin's user record | Titled "Counsellor"; User Type "AGENT"; "Activated" unticked despite "Has Portal Access" |
| 4 | Compared dashboard badges and lists | 31 vs "out of 34", 61 vs "out of 63" |
| 5 | Opened the RP Branch picker | Test branch "ABCDefg" listed |
| 6 | Checked the user's own profile | Surname "Unlink" |

---

## 7. What works well and should be kept

- **Correct scope:** the head office sees every branch's students, enrolments and commission, which the Branch Admin and Counsellor don't.
- **Branch and team structure already exists** (branches, team list, per-user role). GSP 3.0 can build the head-office view on it.
- **Commission estimates are created automatically** when institution data is complete (CQUniversity), with a due date and days-to-due.
- **Real branch and counsellor choice** in the student form for multi-branch agencies.
- **Status buckets with counts** on enrolments and commission.
