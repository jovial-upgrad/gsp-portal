# GSP Legacy Portal (staging) – UX Audit for GSP 3.0

**Environment:** https://stage-legacy-gsp-portal.upgrad.dev/
**Date of audit:** 25 Oct 2026
**Viewport used:** 1037×664 (desktop), ~407 px wide (mobile check)
**Test data created:** student "Test Student QA" (GSP ID 128811, test.student.qa@example.com), enrolment E00102511, application A00175348 (Abertay University, BA (Hons) in Computer Arts), one dummy PDF ("TEST_QA_passport_dummy.pdf"), one private case note ("QA test note - UX audit, please ignore."). Nothing was deleted. No email, live-capture request, "Contact Admission" request or course sync was sent.

> **Important caveat:** this login is **GSP Staff / Admin**, not a recruitment-agency (RP) user. Several things an agency counsellor would see differently (e.g. RP / branch / counsellor pickers, the full list of all agencies' data, the settings menu) are admin-only. Findings about the agency experience below are inferred from what the admin sees, and are flagged where that matters. An audit with a real RP login is recommended.

---

## 1. Login, role and navigation map

### Logged-in user (from "My Profile")

- Name: "Jovial" "Lejo - Stage", email jovial.lejo@upgrad.com, User ID 123973
- "User Type": "GSP Staff"
- "Permission Role": "Admin"
- "User Status": "Has Portal Access"

### Navigation map

- **Home** (`/home`), a grid of 15 icon tiles. On inner pages the same items appear in a hamburger side menu, with "GSP HOME" at the top.
  - Course Search → `/course/search`
  - My Students → `/manage-students`
  - My Enrolments → `/manage-enrolments`
  - My Applications → `/manage-enrolment-course`
  - My Commission → `/manage-commission-transaction` (page header says "MY TRANSACTIONS")
  - Institutions → `/manage-institutions` (header "INSTITUTION LIST")
  - Channel Partners → `/recruitment-partners` (header "RECRUITMENT PARTNERS LIST")
  - My To Do → `/case` (header "MY CASE")
  - My Inbox → `/emails`
  - My Events → `/my-events`
  - Dashboard → `/dashboard`
  - GSP Academy → external site academy2.globalstudypartners.com (not audited)
  - Accommodation → `/accommodation` (embedded "amber" housing search)
  - Health Cover → `/oshc/get-quote`
  - Internships → external marketing page on globalstudypartners.com (not audited)
- **Header** (on every page)
  - Logo → home
  - "?" Help menu
    - "Contact Admission" (opens a modal)
    - "Contact Commission"
    - "Contact System Admin"
  - Gear menu (admin settings)
    - "Announcements Management" → `/announcements/`
    - "Assessment Criteria" → `/assessment-criteria`
    - "Budget List" → `/manage-budget`
    - "Contact List" → `/contacts`
    - "Institution Commission %" → `/manage-commission-items/`
    - "Institution Partners" → `/manage-institution-partners`
    - "Master Partners" → `/master-partners/`
    - "OSHC Policies" → `/oshc/`
    - "RP Branches" → `/rp-branches/`
    - "System Admin" → `/admin/system-admin-control/`
    - "Update Courses" → `/course-sync/`
  - Megaphone: Announcements panel ("Show unread only" toggle, "Latest")
  - Bell: Notifications panel ("Show unread only", "Latest", "Mark all as read", "Show More"), red count badge
  - Avatar menu
    - "Update Profile Image"
    - "My Profile" → `/my-profile`, with tabs "My Profile", "Email", "Notification Alert Channel" and "Announcement"
    - "Logout"
- **Pages reached only through flows**
  - Course Search Result → `/course/course-search-result`, with a card view, a map view and an "Assessment Checklist" view
  - Enrolment Wizard → `/enrolment-wizard/`
  - Student record → `/manage-students/view/{id}`
  - Enrolment record → `/manage-enrolments/view/{E-id}`
  - Application record → `/manage-enrolment-course/view/{A-id}`
  - Case record → `/case/view/{C-id}`
  - Commission transaction → `/manage-commission-transaction/view/{C-id}/{E-id}`
  - Transaction item → `/manage-commission-transaction/transaction-item/view/{T-id}`
  - Institution record → reached by clicking the institution's ID or logo
  - Recruitment-partner record → `/recruitment-partners/view/{id}`

---

## 2. Page-by-page findings

### 2.1 Home (`/home`)
- **Reached by:** logging in, or the logo.
- **Purpose:** launcher for every module.
- **Layout:** header, then a 5×3 grid of large teal icon tiles with labels.
- **Actions:** each tile opens its module. GSP Academy and Internships leave the portal.
- **UX problems:**
  - Nothing on this page needs action: no counts, no tasks, no recent items.
  - "My To Do", "Channel Partners" and "My Commission" lead to pages titled "MY CASE", "RECRUITMENT PARTNERS LIST" and "MY TRANSACTIONS".
  - Two tiles are external links with no "external" indicator.

### 2.2 My Profile (`/my-profile`)
- **Reached by:** avatar → "My Profile".
- **Purpose:** the user's own details and alert settings.
- **Tabs and fields:**
  - "My Profile": read-only grey fields with an edit pencil.
    - First Name, Last Name, Email
    - Mobile and Phone (country picker + number)
    - User ID, User Type, Permission Role, User Status, Job Title
    - Change Password
  - "Email"
    - "Email Group": "Default Email Group:" text field, "Update Email Group" button (disabled)
    - "Outlook Calendar": "Default Outlook Calendar Account" field, "Update Outlook Calendar" button
    - "Email Signature": "Get Template", "Update Signature"
  - "Notification Alert Channel"
    - "Email Addresses" card: email field, "Active" checkbox (unticked for this user), trash icon, kebab menu, "RESET" / "SAVE"
    - "Messenger" section (collapsed)
  - "Announcement": "Announcement Pop up:" Yes/No and "Send GSP Announcement Email:" Yes/No, then "SAVE".
- **Not tested:** settings were not changed (per the audit rules).
- **UX problems:**
  - Labels break mid-word ("Announcemen / t Pop up:").
  - When the side menu is open, the radio label "No" breaks into "N / o".
  - The user's only alert email is not "Active", and nothing explains what that means.

### 2.3 Course Search (`/course/search`)
- **Reached by:** the Course Search tile.
- **Purpose:** find courses that match a student's profile.
- **Layout:**
  - Two free-text boxes: "Search for Course | Career" and "Search for University | Country | City", each with a reset icon.
  - Seven round icon headers, which are labels only: "Student Location", "Institution", "Course Type", "English Test", "Course Fees", "Availability", "Course Duration".
  - Filter fields below the headers.
  - "Search Courses" button, which sits below the fold at 664 px height.
- **Inputs:** 17, all optional.
  - 2 free-text search boxes
  - "Where is the student?" (country)
  - "Where do you want to study?" (country)
  - "Institution State"
  - "Campus Nearest City"
  - "Institution" (multi-select with search and counts, e.g. "ACAP University College (38)")
  - "Course Sector"
  - "Level of Study"
  - "Study Area"
  - "Select English test result type"
  - "Select score" (disabled until a test type is chosen)
  - "Select Course Fee Type"
  - "Select Fee" slider (disabled until a fee type is chosen)
  - "Availability Start" and "Availability End" (dates)
  - "Course Duration" range slider, defaulting to "0 year" – "2 years"
- **Flow:**
  - "Search Courses" opens an interstitial circle: "Here is what we found you .." / "We have 10,000 Courses from 857 Institutions", with "Refine search" and "View search result".
  - With no filters, "View search result" is greyed out (its CSS class is `disabled`) and nothing explains why. 10,000 looks like a result cap.
  - No results: "Sorry no matching course found.." with "Refine search".
  - Pressing Enter in a search box does nothing; you must click the button.
- **Search behaviour (tested):**
  - "Aber" returned "1,325 Courses from 8 Institutions", so partial text matches.
  - "Abertey" (misspelt) returned no results, so search is **not fuzzy**.
  - "Monash" returned nothing (the institution is probably not in the staging data).
  - "Abertay" plus course text "comput" returned "38 Courses from 2 Institutions".
  - Although "Course Duration" defaults to 0–2 years, 4-year courses still appeared, so the slider's effect is unclear.
- **Results page** (`/course/course-search-result`)
  - **Error on load:** a modal says "Institution not found for the selected Course !!" every time results load, including after returning from the map view.
  - **Toolbar:**
    - back arrow
    - heart with count "0" (shortlist)
    - card-view icon, map icon, checklist icon, sort icon
    - "Apply" button (grey)
  - **Left filter panel (teal):**
    - inputs "Course Name", "Level of Study", "Disciplines", "Nearest City", "Institution", each with counts
    - "Run Filter" and "Clear All Filters"
    - placeholder text is nearly unreadable on the teal background
  - **Each result row shows:**
    - heart (tooltip "Select Course"), logo, course name
    - duration and English score bubbles (IELTS / PTE / TOEFLiBT / CAE; a grey bubble means no value)
    - ticks for "Scholarship", "Bridging Program", "Internship"
    - "Course Fee", "Annual Fee", "Application Fee" and "Intake Dates"
  - **Row icons:**
    - "$" opens "No matched commission item".
    - The institution icon (tooltip "Campus Info") did nothing.
    - The pin opens the map view.
    - The last icon opens the university's own course page in a new tab.
  - The course name is **not clickable**. Details are only reachable through the card view.
  - Clicking the hearts gave no visible change, and the count stayed "0".
  - Pagination: "Showing 50 out of 38 items" (page sizes 20 / 50 / 75 / 100).
  - **Currency display is inconsistent:**
    - Abertay shows "GBP $71,800".
    - Abertay University-India shows "$62,000" for the course fee but "GBP $0" for the application fee.
    - The same India course shows "$18,000" in the list and "GBP 18,000" in card view.
    - India-campus courses have empty "Intake Dates".
- **Map view**
  - Breadcrumb becomes "COURSE SEARCH > COURSE SEARCH RESULT > COURSE MAP VIEW >" and overflows the header.
  - Google shows "This page can't load Google Maps correctly." and the map is watermarked "For development purposes only". This may be a staging-only key problem.
- **Card view (course detail)**
  - Carousel of 5 course cards, each with "Why study here?", "$" and a heart; position shown as "1 of 38".
  - Buttons: "Checklist", "View in Institution", "Apply Now".
  - "Course Overview" text (with encoding errors such as "Youll").
  - "Course Information":
    - "Course Schedule(s):"
    - "Prof. Recognition:"
    - "Career Options:"
    - "This course offers the following:"
    - "This course is available in:"
  - "Other Fees Details" on some courses.
- **Assessment Checklist** (the "Checklist" button; the button then reads "Overview")
  - Side-tab sections "Academic", "English Requirement", "Financial", etc.
  - Each section is long free text in a small scrolling, resizable box, e.g. "IELTS - overall score of 6.0 with no band lower than 5.5" and country-by-country academic tables.
- **Specific checks:**
  - **Last-updated date:** none anywhere in course search or course detail. The admin-only "Update Courses" page shows the last successful StudyLink import was the file "SL_StudyLane_20260629_054000.zip" (29 Jun 2026). A newer file (20261019) is waiting, and earlier runs show "Manually Cancelled." and "Exceeded Maximum Time Limit." Agencies cannot see how old the data is.
  - **Eligibility:** shown as text only. Nothing is checked automatically against a student; there is no "student is eligible" result.
  - **Territory:** course search did **not** flag the territory problem that the wizard later reported as "Territory NOT ALLOWED".

### 2.4 Enrolment Wizard (`/enrolment-wizard/`)
- **Reached by:** "Apply Now" in course card view.
- **Purpose:** create (or pick) a student, then an enrolment, then applications, then documents.
- **Layout:** a 4-step stepper: "Student" > "Enrolment" > "Application" > "Documents".

**Step 1 – Student**
- **Screen:** "Add New Student" button, a searchable "Select Student:" dropdown and "Cancel". Dropdown entries look messy, e.g. "45270 - ,MANPREET SINGH" and "35201 - - Abu Sufyan".
- **"Add New Student" modal** (with a "Scan Passport" link): about 44 inputs, **18 required** (marked * below).
  - **Personal Details**
    - First Name*
    - Last Name*, with a "Not Available" checkbox
    - Email*
    - Recruitment Partner* (searchable dropdown)
    - RP Branch* (disabled until a partner is chosen)
    - Counsellor* (disabled until a branch is chosen)
    - Gender (radio, optional)
    - DOB* (date picker)
    - Home Phone (country + number)
    - Mobile Phone* (country + number)
    - Marital Status* (Single / Married)
  - **Passport Details** (all optional)
    - Passport Number, Place of Issue, Nationality
    - Date of Issue, Date of Expiry
    - Place of Birth
  - **Visa question:** "Has student had any previous visa rejections or cancellations (from any country)?*" Yes / No
  - **STUDENT ADDRESS**
    - CURRENT ADDRESS: Street 1*, Street 2, City, State / Province / Region, Postcode, Country*
    - PERMANENT ADDRESS: "Same as current" checkbox, then the same fields (Street 1*, Country*)
  - **EMERGENCY DETAILS**
    - Relationship* (Father, Mother, Sister, Brother, Uncle, Auntie, Cousin, Friend …)
    - First Name*, Last Name*
    - Phone, Mobile*, Email
  - **WORK EXPERIENCE DETAILS**
    - "I have worked after my studies" Yes / No
    - Start of Employment, End of Employment
    - Professional Membership, Employer, Manager
  - Buttons: "Cancel" / "Submit".
- **Validation (exact wording)** when submitting empty:
  - "The Student First Name field is required"
  - "The Student Last Name field is required"
  - "The Email field is required"
  - "The Recruitment Partner field is required"
  - "The RP Branch field is required"
  - "The Counsellor field is required"
  - "The Date Of Birth field is required"
  - "The Mobile Phone field is required"
  - "The Marital Status field is required"
  - "The Visa rejections or cancellations field is required" (rendered glued to the "No" label)
  - "The Street 1 field is required" (×2)
  - "The Country field is required" (×2)
  - "The Relationship field is required"
  - "The Emergency Contact First Name field is required"
  - "The Emergency Contact Last Name field is required"
  - "The Mobile field is required"
  - The page stays scrolled at the bottom; it does not jump to the first error.
- **Wrong values:**
  - "notanemail" → "Email is not valid."
  - Mobile "abc12" → "Invalid Mobile Phone format"
  - A number without a country → "Please select country for Mobile"
- **Interaction problems:**
  - Dropdown pop-overs open away from their field; the partner list appeared at the top of the modal.
  - The search box inside each dropdown is not focused automatically.
  - Searching partners for "test" or "demo" gave "No Record Found"; "upgrad" took several seconds to load.
  - DOB cannot be typed. The picker opens on Oct 2026, and reaching 2002 took **7 clicks** (header → year → decade back ×2 → year → month → day).
  - Fields jump about 25 px as errors disappear, which causes misclicks.
  - The country list starts with Afghanistan, Åland Islands …; it has no common countries first and no default.
- **After submit:** no success message. The wizard moves straight to the Enrolment modal.
- **Data bug:** the saved student shows "I Have Worked After My Studies: Yes", although the question was never answered.

**Step 2 – Enrolment** (a separate step between student and application: **yes**)
- **"Enrolment Details" modal:** 21 inputs, 7 required (4 prefilled, so 3 had to be completed).
  - Student GSP Name* (prefilled, locked)
  - Application Current Country*
  - "Is the student at the destination?*" Yes / No
  - "Int'l/ Domestic" International / Domestic
  - Travelling Preference
  - Commencement Year* (prefilled "2026", although the course's intakes are in 2027)
  - Commencement Month* (all 12 months offered, not limited to the course's intakes)
  - Institution* and Campus* (prefilled)
  - Enrolment Type ("None" / "Package" / "Pathway" / "Unique")
  - ACADEMIC BACKGROUND
    - Level of Education, Year Completed
    - English Proficiency Type, English Proficiency Desc, English Certified Date
    - Language Overall Score, Reading Score, Listening Score, Writing Score, Speaking Score
- **Empty submit:** "No enrolment record found from the selected student.", "The Application Current Country field is required", "The Is the student at the destination? field is required", "The Commencement Month field is required".
- **No validation on scores:** "Language Overall Score" accepted and saved "abc99".
- **Success:** modal "Successfully Created Enrolment".

**Step 3 – Application**
- **Territory warning:** a yellow modal appears immediately.
  - Text: "WARNING: The selected Course is currently not available for the applicant's current location. To avoid delays in offer processing, GSP recommends selecting an alternative course from another institution. Processing unavailable territory applications may take up to 6-8 weeks for an exception approval outcome."
  - Buttons: "Agree and proceed" / "Cancel".
- **Application card**
  - Fields: Institution, Campus, Course (with red "Territory NOT ALLOWED"), Application Type (empty), Commencement Date (empty), Preferences.
  - Trash and edit icons.
  - Buttons: "Back", "Add New Application", "Confirm & Create".
- **Edit opens "Update Application":**
  - Enrolment ID (locked)
  - Course Commencement Date* (free date picker; it does not offer the course's intake dates)
  - Application Type* ("None", "Package End", "Package Progress", "Package Start", "Pathway", "Unique")
  - Institution*, Campus*, Course* (locked)
  - Errors: "The Course Commencement Date field is required", "The Application Type field is required".
- **"Add New Application"**
  - Shows the territory warning again before anything is chosen.
  - Its form lets you pick **any** institution, so one enrolment can hold applications to other institutions.
- **"Confirm & Create"**
  - Modal: "Successful Created Multiple Applications." (only one was created) and "BA (Hons) in Computer Arts: Failed to create Estimate Commission. We have informed GSP Commmisson Team." (typo in the original).
  - This automatically opened a Commission case owned by the logged-in user.

**Step 4 – Documents**
- **Screen:** "Drop documents here to upload" ("Powered by PQINA"), "Upload" (disabled until a file is added), "Finish".
- **No guidance:** no list of required documents, no templates, no expiry dates.
- **After adding a file**, a table appears:
  - Status, Name, "Auto Rename" (checkbox)
  - Category*: Commission, Financial, Institution, Personal, Sponsor, Spouse, VISA, Other, Income, Fund
  - Sub Category*: for "Personal" these are Academic, English, ESOS, Guardianship, Marriage, OSHC, Passport, Proof of ID, Work, Other, Letter of Recommendation, SARS, CV
  - Passport and Academic are hidden under "Personal".
- **No file-type check:** an `.exe` was accepted into the queue ("No Category", then "Ready"). It was removed before upload.
- **PDF upload:** "Successfully uploaded document(s)."
  - The row then shows "Verify Document", and the status text "Uploaded" overlaps the file name.
  - "Verify Document" opens "Take Live Capture": "Student do not have a Live-Capture on file. Please proceed to Live-Capture Or Send the link below to student to complete the Live-Capture", with "Proceed to Live Capture" and "Send request to Student". The modal was closed without action.
- **Finish:** "Successfully finish the enrolment wizard!", then the enrolment record opens.

### 2.5 Enrolment record (`/manage-enrolments/view/E00102511`)
- **Purpose:** the student's case at one institution or intake.
- **Header card:**
  - Fields: Enr ID, Full Name, Nationality, Status "Incomplete", Institution, RP Name, Counsellor, Enrolment BDM ("Kala Anand", assigned automatically).
  - 9-stage tracker: "New", "Pre-Screening" (current, badge "0"), "Application", "Offer", "Verification", "Acceptance", "Visa", "Enrolling", "Enrolled".
- **Tabs:**
  - Left: Enrolment | Documents | History | Cases | Commission | Events | Applications. At 1037 px "Events" is cut off and "Applications" is hidden.
  - Right: Student | Notes | Announcements.
- **Enrolment tab**
  - Read-only fields with watch / delete / edit icons.
  - Includes "GTE Outcome", "Visa Outcome", "Enrolment Stage" "Pre-Screening", "Enrolment Status" "Incomplete", "Status Reason".
  - Milestone dates: "Application Received Date" (25-Oct-2026), "Pre-Screen Approved Date", "Application Lodged Date", "Letter of Offer Issued Date", "GTE Outcome Date", "CoE Issued Date", "Visa Lodgement Date", "Visa Outcome Date".
- **Documents tab**
  - Columns: ID, Type ("Enrolment"), Status ("New"), Category ("Personal").
  - Kebab: "Add Record", "Download All Documents", "Delete Record" (disabled).
  - Clicking a row opens "View Document": "Review and update this document from the same screen", Change Status, Document ID, Document Name, Category, Sub Category, Description, plus a preview. **There is no expiry-date field.**
- **History tab:** a timeline, e.g. "E00102511 updated by Jovial Lejo - Stage" / "Enrolment Stage: New > Pre-Screening", and "R000796756 created by …" (opaque IDs).
- **Cases tab:** two cases created automatically: C00303196 "OFFER 128811 A00175348 Abertay University Intake 2027 - Sep" and C00303195 "A00175348 Error Creating Commi…".
- **Commission tab:** "No Record Found."
- **Events tab:** a week calendar.
- **Applications tab:** App ID, IP Priority, Institution.
- **UX problems:**
  - Nothing says what is missing, who must act next, or whether the application has gone to the university.
  - The stage shows "Pre-Screening" while the status shows "Incomplete", with no explanation of either.

### 2.6 Application record (`/manage-enrolment-course/view/A00175348`)
- **Purpose:** one course application.
- **Header and tabs:** the header repeats the tracker. Tabs: Application | Documents | Cases | Commission | History.
- **Icons:** binoculars opens a watcher pop-over ("Watch this record", "Add watchers", and "Watching this record" listing "UC-Demo Counsellor"); also link, delete and edit.
- **Fields:**
  - Application ID, Enrolment ID (link)
  - Institution, Campus, Course
  - Course Sector Group "Undergraduate", Course Fee Currency "GBP", Course Fee "17950" (this is the annual fee)
  - Application Stage "Pre-Screening", Application Status "Incomplete"
  - Application Type "Unique", Preference "Primary"
  - Acceptance ID (CoE/CAS)
  - **External Reference "Territory NOT ALLOWED"** (a reference field being used as a flag)
  - Institution SID
  - Course Commencement Date 06-Sep-2027
  - Admission Officer (empty)
  - Course Completion Date, Tentative Course Completion Date 06-Sep-2031
  - STUDYLINK DETAILS: SL Branch, SL Application ID, SL Applicant ID, SL Application Status
- **"ASSESSMENT REQUIREMENT"**
  - Two progress bars, "RP To Do : 0%" and "GSP To Do : 0%". These are the only hint anywhere of a split in responsibility.
  - Items are grouped (Academic, English Requirement, Personal, Pre-CAS, Financial), each like "R000796755 UG Information Technology Academic Requirements Part I" with a "Not started" pill and very long text (e.g. UK visa funds rules).
  - Items are not linked to uploads, and clicking an item did nothing.
- **Edit mode:**
  - Institution, Campus and Course become editable.
  - Stage and Status stay locked (grey), even for an admin.
  - Options found in the page: Status "Incomplete", "In Progress", "Declined", "Withdrawn", "Deferred", "Application Submitted"; Stage is the 9 stages above.
- **Who acts next:** not stated. **Does the university have it:** not stated ("Application Lodged Date" is empty, and there is no "sent to institution" indicator).

### 2.7 Case record (`/case/view/C00303196`)
- **Purpose:** an internal work item (offer, commission, etc.).
- **Fields:**
  - Name
  - Description, which shows developer text: "Creates an OFFER case for each "PRIMARY" application when the Submit Application action in Enrolment record page is clicked."
  - Case ID, Owner "admin users"
  - Case Stage "Register", Case Status "Not Started", Case Outcome, Case Closed
  - Case Type "Offer", Assigned Queue "Admission", Assigned User (empty)
  - Priority "Medium", Case Opened, Response Date
  - App ID
- **Tabs:**
  - Left: Case | Document | History | Email.
    - The Email tab has a "Compose New Mail" option (not used) and shows "No Record Found.".
  - Right: Notes | Task | Student | Application.
- **Notes → "Add Record"** ("Case > Notes")
  - Category*, with 28 options from "Agreement Follow-up" to "General" (e.g. "COE", "CohortGo", "GTE", "IP Requests", "SARS"-style jargon)
  - Sub Category, Notes, "Private" checkbox, "Mention"
  - The saved note card shows author, time, "Mentioned: NA", category and sub-category. There is **no private marker, no reply and no thread**.
- **Inconsistent empty states:** "No Record Found." (Email) and "No Records Found" (Notes/Task).

### 2.8 My Students (`/manage-students`)
- **Purpose:** list of students.
- **Layout and loading:**
  - "Keyword Search" box and a kebab menu: "Detail View", "Add Record", "Delete Record", "Sort Records", "Advanced Search".
  - About 8 s spinner on load; 84,092 items.
- **Rows:** large cards with ID, Last Name, First Name, DOB, RP Name, Nationality, Counsellor, Branch BDM. About 5 rows fit on screen.
  - There is **no stage or status column**.
  - The name is not clickable; only the ID or avatar opens the record.
- **Search:** "Test Stud" found 3 records, so partial matching works.
- **Advanced Search:**
  - "Created On" From / To, each with a period dropdown (DATE / DAY / MONTH / YEAR / QTR / FY / WEEK) plus DD-MM-YYYY
  - Nationality, Counsellor, Master Partner, Recruitment Partner, RP Branch
  - RP BDM and Branch BDM, each with Login User / Queue / Sales Region User / User List / Blank
  - Current Country, Permanent Country
  - Is Active
  - Buttons: Clear / Cancel / Apply
- **Data quality** visible in staging: future DOBs (e.g. 05-Oct-2026) and names like "sdasfdsa" were accepted.
- **Student record** (`/manage-students/view/128811`)
  - Left tabs: Student | Documents | History | Cases | Commission | OSHC.
  - Right tabs: Enrolment | Notes | Contact. Contact shows the emergency contact "Test Parent QA".
  - "Take a Live Photo" link under the avatar.
  - Documents tab: ID / Type / Status / **Source** = "E00102511". The document is owned by the enrolment and shown on the student.

### 2.9 My Enrolments (`/manage-enrolments`)
- **Status buckets:** "9228 In Process", "10788 Acceptance", "8292 Commenced", "70002 Not Proceeding".
- **Detail view (cards):**
  - Each card has a 9-stage tracker.
  - A badge such as "1/0" (tooltip "Primary / Additional Applications") opens the Applications tab.
  - A purple "$" opens the Commission tab.
- **Kebab:** "Detail View", "Add Record", "Delete Record", "Assign BDM", "Sort Records", "Advanced Search". **No export.**
- **List view:**
  - The bucket tabs disappear and the total changes to 87,502.
  - Sort order changes (the newest E00102511 is not first).
  - Very wide grid: Enr ID, GSP ID, Full Name, Nationality, Application Current…, Stage, Status, Primary #, Additional #, Institution, Commencement year, Commencement month, RP ID, RP Name, RP Branch …
  - Status values seen: "Incomplete", "Offer Issued - Co…", "Deferred".

### 2.10 My Applications (`/manage-enrolment-course`)
- **Grid columns:**
  - App ID, GSP ID, Institution SID, Full Name, Application Current…
  - Institution, Campus, Course, Preference (Primary / Additional)
  - Stage, Status
  - Commencement Date
  - App Type (None / Pathway / Unique / Package Start / Package End / Package Progress)
  - Type Of Student (New / Progression / Transfer)
- **Volume:** 155,235 items.
- **Kebab:** "Show / Hide Columns", "Advanced Search", "Filter Columns". **No export and no status tabs.**
- **Search problem:** searching "A00175348" or "Test Student QA" returned "No Record Found" about 15 minutes after the application was created. The older "A00175314" was found. The new application could not be found from this list (see Broken).

### 2.11 My Commission (`/manage-commission-transaction`, header "MY TRANSACTIONS")
- **Tabs:** "12947 Estimate", "17355 In Process", "38899 Paid".
- **Grid:**
  - Transaction Item ID, Transaction Date, Transaction Due Date
  - Transaction Type ("Agency Charge" / "Institution Charge"), Invoice …
  - Comm Type ("Course Commission" / "Additional Commission")
  - GSP ID, Full Name
  - Transaction Status ("Confirmed" / "Ready for Payment"), Invoicing Sequence, Currency
  - Tran Course Fee, Institution, Course, Course Sector, Commencement Date, Enrolment Commence…
  - Agency (empty)
  - There is **no commission amount column** in the list.
- **Transaction item** (T00301271)
  - Transaction Date "24/Oct/2025" (slashes, unlike the "24-Oct-2025" format used elsewhere)
  - Status "Confirmed", Course Fee 16680 AUD
  - "Ex GST Amount" 1751.4, "Days to Due Date" -336
  - "SRP Ex GST" / "SRP GST" / "SRP Amount" / "SRP AUD"
  - "Is Exported", "Lock AUD", "Write Off"
  - Documents tab: "No Documents."
- **Transaction** (C00240312)
  - Transaction Type "Agency Charge", Total Tran Course Fee 33360 AUD
  - **"Commission %" 70**, "GST %" 10 (but GST Amount $0.00), "Total Ex GST Amount" 3502.8
  - Item grid columns include "Invoice Document Count" (blank)
  - Course shown as **"cid-mm-01-120467"** (an internal ID, not the course name)
- **Rates and split:**
  - Agency-side rates are visible on the partner profile ("Commission %" 70). Institution rates are visible on Institution cards (e.g. "20%" "Full Course Tuition", "12.5%" "First 12 month of course").
  - Nothing states plainly "the agency earns X of the institution's Y". The meaning of "SRP" is not explained.
  - No invoice PDF was found.

### 2.12 Institutions (`/manage-institutions`) and institution record
- **List:** 1,013 cards.
  - Bubbles: "Apps In Process", "Apps Commenced", "Apps Not Proceeding".
  - "World Ranking" (NA), Institution Partners, Provider ID (e.g. "pid-mi-au-9750"), Provider Type, Provider Country, Engagement Status "Agreement Executed".
  - Commission chips by level.
  - Kebab: Print, Detail View, Add Record, Sort, Advanced Search.
  - Labels overlap ("Provider Type").
- **Record** (Adelaide University, 1576)
  - Header: "26 Apps In Process" (the list card said 24) and the relationship manager.
  - Left tabs: Institution | Performance | Territory Rules | Documents | History. Right tabs: Notes | Contact | Links.
  - **Performance:** a pivot by "App Country" against the pipeline stages. This is the nearest thing to a pipeline view.
  - **Territory Rules:** Country / Priority / Region rows with checkboxes, filters ("All Status", "All Regions") and a download icon. What a ticked box means is not labelled.

### 2.13 Channel Partners (`/recruitment-partners`)
- **List:** 6,166 partner cards with app counts, BDM, Primary Contact and an onboarding tracker ("New" > "Initial Registration" > "Due Diligence" > "GSP Approval" > "Registered").
- **Record:**
  - Tabs: Company | Branches | Company Profile | Document | History | Cases.
  - Fields include "Commission %" (70) and "Tier".
  - Notes show staff call logs.

### 2.14 My To Do (`/case`, header "MY CASE")
- **List:** 746 cases. Columns: Case ID, Name, Case Type, Case Stage, Case Status, Owner, Assigned …
  - Most are "Not Started", owned by "admin users".
- **Kebab:** Case View, Delete Record, Show / Hide Columns, Advanced Search, Filter Columns.
- **UX problems:**
  - The tile says "To Do", but there are no due dates, no "assigned to me" view and no sorting by urgency.

### 2.15 My Inbox (`/emails`)
- **Toggle:** Inbox | Sent | Draft | Archive.
- **Toolbar:** icon-only buttons; their meaning only shows on hover ("Filter By Email Group", "Download CSV", …).
- **Grid:** Categ…, From Name, Status ("New"), Case ID, Case Status, Case Pr…, Case Last Modified, Object ID, Subject. 2,423 items.
- **Not tested:** individual emails were not opened.
- **Observations:**
  - This is a shared mailbox, not one conversation per student.
  - Every visible row had status "New" and no Case ID, so it is unclear whether anyone has handled them.

### 2.16 My Events (`/my-events`)
- **Layout:** a week calendar ("19 - 25 Oct 2026") with previous / next / today / zoom controls and a "Calendar View" toggle.
- **Display problems:** the "Week" button and the Sat/Sun columns are cut off at 1037 px, and the empty week shows no empty-state message.

### 2.17 Dashboard (`/dashboard`)
- **Default dashboard:** "2.0 Adoption Monitor".
  - Widgets: "Active RP users by Region" (1,126), "India Enr created by RP" (261 / 5,332), "Nepal Enr created by RP", "Pakistan Enr created by RP".
  - Legends page through "1/38".
- **Gear bar:**
  - A dropdown of about 230 saved reports, e.g. "Conversion To-Do (GLOBAL)", "CY22 Pipeline - 1.Global", "Commission Team To-Do", plus many "Copy of …" entries.
  - "Select Catego…" and "Application Bridge Dashboard".
  - Icons for add, edit, copy, delete, pin, print, view and refresh.
- **Purpose:** this is staff BI, not an agency pipeline. There is no personal task list or "my students by stage" view on it. Charts have overlapping labels.

### 2.18 Accommodation (`/accommodation`)
- **Layout:**
  - Embedded "Search Housing" (powered by "amber"): "Search by College, City or Country", "Sort", "Price", "Move In Month", "Room Type".
  - "Showing 329 options in Australia", with cards and pink "View" buttons.
- **Problems:** no breadcrumb, a different visual style from the rest of the portal, and no link to a student.

### 2.19 Health Cover (`/oshc/get-quote`)
- **Layout:**
  - Hero "Let's get started".
  - "Request A Quote" form: Adults (1), Children (0), Policy Start Date, Policy End Date, "Get Quote Now".
- **Empty submit:** "The Policy Start Date field is required" and "The Policy Finish Date field is required" (the label says "End").
- **Problems:**
  - Purple error text on teal is hard to read.
  - The page covers Australia only and is not linked to a student.
- **Not tested:** a quote was not requested.

### 2.20 Admin settings (viewed only)
- "ANNOUNCEMENTS" (IDs like AN00001750, descriptions such as "This is scholership annoucement")
- "ASSESSMENT CRITERIA" (lookup view by institution / sector / area of study)
- "MANAGE BUDGET" (monthly grid, test rows all 0)
- "CONTACTS" (tabs Student / RP / Institution / Institution Partner)
- "COMMISSION ITEMS LIST" (5,985 rows; Commission Type values: Course Commission / Additional Commission / Bonus; has a CSV icon)
- "INSTITUTION PARTNERS LIST"
- "MASTER PARTNERS LIST" (includes "Test MP" twice and "upgrad connet")
- "OSHC LIST"
- "RP BRANCHES LIST"
- "SYSTEM ADMIN CONTROL": **blank page** (see Broken)
- "COURSE SYNC RECORD" (described in 2.3; "Sync" was not clicked)

### 2.21 Notifications and announcements
- **Bell:**
  - The badge read "12", then "13" after the wizard.
  - At first the panel was empty, even after waiting and clicking "Show More".
  - Later it showed one item: "A00175348 New Application: A00175348 created for Test Student QA - Abertay University 25-Oct-2026 09:58".
  - The other 12 counted items never appeared.
- **Megaphone (announcements):** only a grey skeleton loader appeared during the check.
- **Alert channels:** email (per "Notification Alert Channel") and "Messenger" (collapsed, not inspected).
- **Not observed:** no in-app alert for status changes (none happened during the session).

### 2.22 Help → "Contact Admission"
- **Form:** a modal with "Details:*" (free text), a document drop zone, and "Cancel" / "Submit".
- **Problems:** no subject, no way to pick a student or application, and no expected response time.
- **Not tested:** not submitted.

---

## 3. Main flows, step by step

Counts are approximate, from this session. "Interaction" means one click, one typed field or one key press.

### 3.1 Search for a course → view details
1. Open Course Search.
2. Type a university.
3. Type course text.
4. Scroll and click "Search Courses".
5. Click "View search result".
6. Dismiss the error "Institution not found for the selected Course !!".
7. Click the card-view icon to read details.
8. Click "Checklist" to read the entry rules.

That is about **8 interactions**, and 2 of the 17 inputs were used. Pressing Enter does not submit, and the course name does not open details.

### 3.2 Create student → enrolment → application → document (wizard)

| Step | Required fields | Approx. interactions | Notes |
|---|---|---|---|
| Course card "Apply Now" → "Add New Student" | – | 2 | |
| New student form | 18 required (about 44 total) | ~46 | DOB alone took 7 clicks; each searchable dropdown takes 3–4 |
| Enrolment Details | 7 required (4 prefilled) | ~9 (+2 to fix the wrong prefilled year) | Separate step: **yes** |
| Application | 2 required on edit (date, type) | ~12 | Territory warning; free date picker |
| Documents | Category + Sub Category per file | ~6 | No checklist |
| Success modals to dismiss | – | 4 | Student creation gave no confirmation at all |
| **Total** | **~27 required fields** | **~80** | 4 steps, 6 modals |

### 3.3 Upload a document later
Enrolment record → Documents tab → kebab → "Add Record" (or the wizard drop zone) → choose Category and Sub Category → Upload.

- Documents are stored against the **enrolment**. The student record lists them with "Source" = the enrolment ID.
- Not tested: whether a second enrolment for the same student reuses them.

### 3.4 View status
- My Enrolments → find the card (bucket tabs help) → tracker plus "Status".
- My Applications → grid "Stage" / "Status" columns. The newly created application could not be found here.
- The record header tracker shows the stage only. "Next action" and "owner" do not exist.

### 3.5 View commission
My Commission → choose "Estimate", "In Process" or "Paid" → open a Transaction Item ID → follow "Transaction ID" to see "Commission %".

That is about **4 clicks**. No amount appears in the list, and no invoice was found.

---

## 4. Top 15 UX problems (ranked by harm to a busy agency counsellor)

1. **Nothing says who must act next or what is missing.**
   - "Pre-Screening" / "Incomplete", "RP To Do : 0%" / "GSP To Do : 0%" and "Not started" items are shown, but no record says "You need to upload X" or "Waiting for university".
   - "Application Lodged Date" is empty, and nothing shows whether the university has the application.
2. **The new application is not findable in My Applications.** Searching by ID or by name returned "No Record Found" about 15 minutes after creation.
3. **Long, high-effort student form.** 18 required of about 44 fields, including emergency contact and permanent address before any course is chosen. The date of birth cannot be typed (7 clicks), and dropdowns need 3–4 actions each.
4. **Territory restrictions appear only after the student and enrolment exist.** Course search showed "BA (Hons) in Computer Arts" as normal, then the wizard said "Territory NOT ALLOWED" and "6-8 weeks".
5. **Course search does not tolerate typos** ("Abertey" → no result), has 17 inputs, no Enter-to-search, an extra interstitial step, and a greyed-out "View search result" with no reason.
6. **A spurious error on every results load:** "Institution not found for the selected Course !!".
7. **No document checklist.** Uploads are generic. Category and Sub Category use internal taxonomy (Passport sits under "Personal"). There are no templates and no expiry dates.
8. **Eligibility is pages of free text** ("Assessment Checklist" / "ASSESSMENT REQUIREMENT"), with no automatic check against the student's scores or country.
9. **Commission is hard to read.** "Agency Charge" vs "Institution Charge", "SRP", "Commission %" 70 without a base rate, a course shown as "cid-mm-01-120467", no amount in the list, no invoice.
10. **Course data freshness is hidden.** There is no "last updated" date; the admin page shows the last import was 29 Jun 2026.
11. **Navigation labels don't match their pages.** "My To Do" → "MY CASE", "Channel Partners" → "RECRUITMENT PARTNERS LIST", "My Commission" → "MY TRANSACTIONS".
12. **Communication is fragmented.**
    - Case notes have no replies or threads.
    - "Contact Admission" is a free-text box with no student link.
    - The inbox is a shared mailbox with every row "New".
    - Notifications under-report (badge 13, one item shown).
13. **Inconsistent data display.**
    - Currency appears as "GBP $71,800", "$62,000" and "GBP 18,000" for similar data.
    - Dates appear as "24/Oct/2025" and "24-Oct-2025".
    - Empty states read "No Record Found." and "No Records Found".
    - Counts differ (24 vs 26 apps in process).
14. **Lists are hard to scan.**
    - Student cards show 5 per screen and no status.
    - Names aren't clickable (only IDs or avatars are).
    - Grids need long sideways scrolling.
    - There is no export for students, enrolments or applications.
15. **Weak validation and silent data errors.**
    - Score "abc99" was saved.
    - "Worked after studies" was saved as "Yes" without an answer.
    - An `.exe` file was accepted for upload.
    - Commencement year and month were not limited to the course's intakes.
    - Errors don't scroll into view, and the form layout jumps as errors clear.

---

## 5. Limitations and missing features

- **No agency (RP) view audited.** The login is "GSP Staff" / "Admin".
- **Course search**
  - No fuzzy search, saved searches or comparison.
  - The shortlist heart showed no visible effect.
  - No eligibility match against the student.
  - No last-updated date.
- **Records**
  - No "next action / owner / due date" anywhere on students, enrolments or applications.
  - No visible "submitted to university" step for an agency. The case description mentions a "Submit Application action in Enrolment record page", but no such action was found on the enrolment record.
- **Documents**
  - No required-documents checklist, templates or expiry dates.
  - No file-type restriction was seen.
- **Communication**
  - No chat and no threaded replies on notes.
  - "Contact Admission" cannot be tied to a student.
  - Not verified: whether agencies see staff case notes.
- **Commission**
  - No plain "you earn X" figure and no invoice download.
  - Nothing explains the "Estimate" / "In Process" / "Paid" lifecycle.
- **Dashboard**
  - No personal pipeline or task list for a counsellor. About 230 staff reports instead.
  - Export: CSV exists only on Inbox and Commission Items. Students, enrolments and applications have none.
- **Accommodation and OSHC** are disconnected tools; neither attaches to a student record.
- **Could not check:**
  - Offer, visa and enrolment stages (no record advanced during the session)
  - Live capture
  - Sending a "Send request to Student"
  - "Contact Admission" submission
  - Course sync
  - GSP Academy and Internships (external)
  - Email detail view
  - Whether a second enrolment reuses documents

---

## 6. Anything broken

| # | What I did | What happened |
|---|---|---|
| 1 | Loaded course search results (any query, and again after the map view) | Modal "Institution not found for the selected Course !!" every time |
| 2 | Clicked the "Campus Info" icon on a result row | Nothing happened |
| 3 | Clicked "$" on a result row | "No matched commission item" |
| 4 | Clicked heart (shortlist) on two results | No visible change; counter stayed "0" |
| 5 | Opened the map view | "This page can't load Google Maps correctly." and the watermark "For development purposes only" (possibly a staging key) |
| 6 | Created A00175348, then searched My Applications by ID and by name | "No Record Found" (older IDs are found) |
| 7 | Created the student without answering the work question | Record shows "I Have Worked After My Studies: Yes" |
| 8 | Entered "abc99" as Language Overall Score | Saved without error |
| 9 | Confirm & Create (1 application) | "Successful Created Multiple Applications." plus "Failed to create Estimate Commission. We have informed GSP Commmisson Team." |
| 10 | Opened the bell at the start of the session | Badge "12", list empty even after "Show More"; later only 1 of 13 shown |
| 11 | Opened Settings → System Admin | Blank page after more than 10 s; header icons disappear; no console errors |
| 12 | Uploaded a document | "Uploaded" status text overlaps the file name |
| 13 | Enrolment record at 1037 px | "Applications" tab hidden off-screen, "Events" cut off |
| 14 | Case description | Shows internal developer text to users |
| 15 | Wizard DOB field | Typing is ignored; picker only |

---

## 7. What works well and should be kept

- **The 9-stage tracker** (New → … → Enrolled) is a clear mental model, shown on lists and records.
- **Status bucket tabs with counts** on My Enrolments and My Commission ("In Process", "Acceptance" …; "Estimate", "In Process", "Paid").
- **The wizard concept:** one guided path from course to student to enrolment to application to documents, with pre-filled institution, campus and course from the search.
- **Early territory warning in plain language,** with the time impact ("6-8 weeks"). It should be moved earlier, into search.
- **Responsibility split hint:** "RP To Do" vs "GSP To Do" progress bars. Build on this.
- **Inline field validation messages** that name the field ("Email is not valid.", "Please select country for Mobile").
- **Searchable dropdowns** and the "Same as current" address shortcut.
- **The document preview modal** with zoom, and "Download All Documents".
- **Watchers** on records ("Watch this record", "Add watchers").
- **Course detail content** (overview, career options, entry rules, intake dates) and the institution "Performance" pivot.
- **Mobile basics:** home tiles, enrolment cards and record pages reflow to a single column with a bottom bar. Wide grids and course search still need work.
