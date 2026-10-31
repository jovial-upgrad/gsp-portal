# ApplyBoard Recruitment Partner Portal: Competitor UX Audit

**Purpose:** benchmark for the GSP redesign. I looked at how ApplyBoard handles the three problems already known in GSP:
- About 80 interactions and 27 required fields to start one application.
- No signal of who must act next.
- Commission is hidden.

**Scope and method**

- **Where:** app.applyboard.com/agent. The partner account was already logged in.
- **When:** 25 Oct 2026, mostly at 1054–1440 px wide, plus a mobile pass at about 400 px.
- **Read-only rule:** nothing was saved, submitted, uploaded, paid, sent, shared or withdrawn. Every form was cancelled before its final button.
- **Privacy:** student details are written as [student], and the agency, its staff and the account manager are not named. Commission is described as a pattern only.
- **Counts:** interaction counts are approximate. One click, one selection or one typed field each counts as one interaction.

---

## 1. Navigation map

**Global header**

- Left: "Home".
- Right:
  - Bell, which opens the /important_updates page
  - Elevate badge (/elevate)
  - Avatar menu: name, email, "My Account" (/profile), "Logout"
- Banner on most pages: "You have 69 important updates".

**Left icon rail** (labels show on hover or when expanded; on mobile it becomes a hamburger drawer)

| Item | URL pattern | What it is |
|---|---|---|
| Home | /agent | Dashboard |
| Programs & Schools | /search | Course search, filters, eligibility, compare |
| Students | /students → /students/{id} | Student grid → profile with tabs |
| Applications | /applications → /applications/{id} | Application grid → application page |
| My Tasks | /tasks | Cross-application task cards |
| Payments | /agents/{id}/payments | Purchases and the commission ledger |
| Wish Lists | /wishlist | Program shortlists for each student |
| 360 Solutions | /360-solutions | GIC, loans, language tests, visa (cross-sell) |
| Invite Students | /invite-students | Intake form, QR code, embeddable search, student portal |
| TrainHub | /trainhub | Training courses |
| Offers Dashboard (New) | /agent/offers | Fee waivers, bonus commissions, offers by country |

**Other routes**

- /schools/{school-slug}/programs/{program-slug}: program detail
- /search/compare/{token}: comparison, a shareable URL
- /important_updates: notifications
- /profile: account, with 5 tabs
- /elevate: tier programme

**Pages that open in a new tab:**
- Program links
- Student IDs
- "View Application"
- Compare
- Task titles

This leaves the agent with many tabs open quickly.

---

## 2. Flow-by-flow findings

### 2.1 Home / Dashboard (/agent)

**On first load, two modals appear before any work can start:**
1. A school promo: "St. Lawrence College: Now a Prime Institution" with "Register now" and "No, Thanks".
2. A WhatsApp opt-in: "Want instant updates?" / "Enable WhatsApp notifications now!". It has a pre-unticked marketing checkbox, "Yes, I'd like to receive marketing communications via WhatsApp."

**Screen content, top to bottom:**

1. "Welcome, [agent]!", with "New service" (menu: "Start GIC application", "Start loan application") and "+ Add new student".
2. KPI cards: "18 Tasks", "18 Applications", "4 Accepted", "0 Rejected", "15 Students".
3. Elevate card:
   - "Simple Tiers. Higher Commission."
   - "Gold" / "Enjoy Gold tier perks with 75% commission."
   - "Elevate Points 0 (Last 12 months - as of Oct 1, 2026)"
   - "Keep going, you're just 300 more Elevate Points away from Platinum!"
4. "Stay informed" links:
   - TrainHub
   - Signed agreement
   - ApplyBoard certificate
   - Commissions (opens the school commission table)
5. "Your support services":
   - Email
   - "Start live chat"
   - "Chat on WhatsApp"
   - Knowledge base
   - **A named account manager with email and phone**
6. "Academic and Visa tools":
   - Canada study planner (Beta)
   - Canadian visa calculator
   - US mock interview practice
   - UK credibility interview practice
   - Personal statement guide
   - Essay guide
7. "Essential steps": an 8-step onboarding checklist, from "Add your first student" to "Track the application status".
8. "Task management / A list of important application requirements":
   - Intake tabs "Fall 2026 … Fall 2027"
   - A matrix with columns "Paid applications", "Final offers", "Visas", "Promotions" and rows Applications and Tasks (split High / Medium / Low)
   - "See all tasks"
9. Training course cards ("Course progress 0%") and a floating chatbot.

**What works**
- The KPI cards deep-link into work.
- The tier and commission percentage appear on the first screen.
- A real person to contact is visible.

**What's confusing or slow**
- Two blocking modals appear before work.
- Most of the page is marketing and onboarding rather than "what needs me today".
- The intake × priority matrix shows only zeros even though 18 tasks exist, so it contradicts the "18 Tasks" card.

### 2.2 Course search and eligibility (/search)

**Search screen**
- "What would you like to study?" box, plus "Destination" and "Institution" dropdowns.
- "Advanced filters" (New).
- "Quick Filters:" Prime, Instant Submission, Exclude Pathway Programs, PGWP, Scholarships Available.
- "Save filters", "Load saved filters" (New), "Smart filters" (AI).
- "Student eligibility filters", and a kebab menu with "Help & FAQs" and "Give feedback".

**Empty state:** "Apply at least one filter above to search for programs." The page also shows a "Recently Viewed Programs" carousel. It took about 10 s to render.

**Typo tolerance**
- **Keyword box:** not tolerant. "computr scince" returns "No programs found." with three plain-language reasons:
  - "You may have applied too many filters or filters that conflict with each other…"
  - "You might have included an institution name or destination … in the 'What would you like to study?' search field. Please use the dedicated filters…"
  - "The keyword you have entered may not match any programs. Consider trying different keywords."
- **Institution dropdown:** not tolerant. "hertfordshre" gives no options and no message, while the partial "hertford" works.
- **Smart filters (AI):** tolerant.
  - Typed: "masters in data scince in UK, tution under 20k, sept 2027".
  - Result: "Matched Filters (5)": United Kingdom · September 2027 · Master's Degree · Data Science · "Tuition: 10,001 to 20,000".
  - Each chip is removable. There is "Happy with the detected filters?" 👍/👎 and "Add to existing filters".
  - Small miss: "under 20k" was mapped to the 10–20k bucket, which drops cheaper programs.
  - Applying gave "107 programs found for "Data Science"" with a row of active-filter chips ("September 2027 ×", "+3", "Clear all").

**Results header**
- "2000+ programs found for "computer science"".
- Sort options: Best Match (default, ranked by success score), Tuition low–high / high–low, Application fee low–high / high–low, **Commission**.
- Gear icon → "Display settings": "Show commissions" toggle, **off by default**. Commission stays hidden on cards until the agent turns it on, so the screen is safe to share with a student. I didn't save it.
- "Compare" toggle.

**Program card fields** (2 per row at 1054 px, 12 per page)
- Corner badges: "Instant Submission", "Instant Offer".
- School logo and name, level, program name (opens a new tab).
- Tags: High Job Demand, No Visa Cap, Loans, Prime, Top, Popular, Fast Acceptance, Scholarships Available.
- Rows: Location, Campus city, "Tuition (1st year)", "Application fee", Duration.
- "Success chance: High" + "see details".
- "Available intakes" (Jan / May / Sep 2027).
- "Create application" button.

**Success chance details**
- "Program Success Chance Details" lists the inputs, each with a value:
  - Acceptance Rate (High), Turnaround Time (Fast), Program Popularity, School Rank
  - Instant Submission (Yes/No), Instant Offer, PGWP Eligibility, High Job Availability, Prime
- These roll up to "Overall Success Chance: High".
- A note says "Filling out the eligibility filters provides more accurate and personalized insights. This tool is for general guidance only." The score is explained, not a black box.

**Advanced filters** (side panel)
- Program level, Intakes.
- **"Study gap (years)"** and **"Backlog (failed courses)"** steppers. These match the reality of Indian applicants.
- Prerequisite subject missing, Education background missing.
- Duration 1–96 months, Field of study, Tuition, Program's language, Intake status, Institution type.
- Checkboxes: PGWP-only, Visa-Cap-exempt, free applications, exclude pathways, include non-partner schools.
- 12 "Program feature" chips.

**Student eligibility filters**
- Radio choice: "an existing student profile" (search by name, email or ID) or **"a guest student (with no profile yet)"**.
- Guest fields:
  - Study Permit / Visa? (**the only required field**)
  - Nationality, Last Level Of Study, Education Country
  - Grading Scheme (locked until both previous fields are set: "You should first select both 'Education Country' and 'Last Level Of Study'.")
  - English Exam Status
  - "I'm open to taking a language proficiency course…"
- So: 1 required field out of about 7.

**Saved filters:** "No saved filters yet." "Save filters" appears once a query exists. I didn't use it, because it would write data.

**Compare**
- With the toggle on, each card gets a "Compare" checkbox.
- The bar shows "0 of 24 Selected (select at least 2 programs to compare)", then "1 Selected (select at least 1 more)". "Compare programs" stays disabled until 2 are picked.
- It opens a **new tab** at /search/compare/{token}: "Programs Comparison / Comparing 2 programs".
- Buttons: "Share Excel over email", "Share link", "Download".
- Sections: Institution, Program, Requirements (IELTS/TOEFL/PTE/Duolingo bands, min GPA, GRE/GMAT), Intakes and Submission (deadlines), Cost.
- Problems:
  - Several deadlines say "Unknown".
  - Two deadlines were already in the past (Oct 2026) and not flagged.
  - TOEFL sub-scores show "1.0", which looks like placeholder data.
  - Tuition is unformatted: "$22601.0 CAD / Year".

**Program detail page**
- Header: school, title, tag chips, photo/video gallery.
- Anchor tabs: Overview · Job Insights (New) · Admission Requirements · Scholarships · Similar Programs.
- Sticky "Create application" and heart (wish list).
- Fact column:
  - Level, Length, Language, CIP Code
  - "Cost of Living", "Gross Tuition / First Year", "Application Fee", "Other Fees" (ancillary, health insurance) with "Show More"
- "Program Intakes": Jan 2027 "Open", the others "Likely open".
- PGWP box with the IRCC disclaimer.
- **Commission box:**
  - "15.00% of Net (Base) Tuition"
  - "COMMISSION BREAKDOWN"
  - "Payout: Up to 2 installments"
  - A long disclaimer
  - "Go to school commissions table."
- Admission requirements: min education, "Minimum GPA" with a **"Convert grades"** tool, minimum test scores, and "Applicants … yet to complete an acceptable language test, can do so, but must provide valid results before receiving a final offer letter."
- Scholarships carousel: amount, **"Auto applied: Yes"**, eligible nationalities and levels.

**Wish list:** "Add to Student's Wish List / Search and select a student to add this program to their wish list." Shortlists belong to a student, not to the agent. Cancelled.

### 2.3 Add a student (/students → "+ Add new student" → "Add Student")

**Students grid**
- Columns: Student ID, Student email, First name, Last name, Nationality, each with its own filter box. "1 - 15 of 15".
- Row kebab: "Search and Apply", "Edit Profile", "Manage Applications", "Student Wish List".
- There is no status, application count or owner column.
- The grid exposes data quality problems: several last names are "." or a copy of the email address.

**Modal "Add new student"** (one screen, scrolling)
- Info at the top: "Did you know you can also bulk import students. Learn how here".

| Section | Field | Required |
|---|---|---|
| Personal information | "Autofill with passport": "Auto-complete this section by uploading the student's passport. This is optional, but strongly recommended." Opens an inline drop zone: "Accepted file formats: PNG, PDF, JPG, and JPEG. Maximum file size 10MB." | – |
| | First name | ✱ |
| | Last name | ✱ |
| | Middle name | |
| | Date of birth (YYYY-MM-DD mask + calendar) | ✱ |
| | Country of citizenship (251 options) | ✱ |
| | Passport number: "optional, but strongly recommended" | |
| | Passport expiry date | |
| | Gender (Male / Female) | |
| Contact information | Student Email: "This email will be used for submitting applications to schools. ApplyBoard will not communicate directly with students." | ✱ |
| | Phone number | |
| Lead management | Status (New Lead / Follow up / Ready to Apply) | |
| | Referral Source (Walk in, Facebook, Instagram, … Immigration agent) | |
| | Country of Interest | |
| | Services of Interest | |
| Consent | "I confirm that I have received express written consent from the student whom I am creating this profile for and I can provide proof of their consent upon request…" | ✱ |

- **Counts:** 1 screen, **6 required of 15 fields**, about **11 interactions** at minimum.

**Validation**
- Inline, on blur: "Please enter a first name"; "Email is invalid" (for test@example).
- The date of birth mask silently rejects DD/MM. Typing "31/12/2005" left "3YYY-MM-DD" with no message, which is a trap for Indian counsellors.

**Duplicates:** couldn't be checked without saving.

**Cancel:** closes with no "discard changes?" prompt, so typed data is lost silently.

**Bulk import**
- "Use this tool to easily import students… This tool requires you to use a template. Click here to access the .csv template."
- "Please limit upload to 50 students at once."
- "Assign Students to…" (team member, prefilled with the current user), Referral Source, "CSV File to Import ✱", consent checkbox.
- Not run.

**Full student profile** (/students/{id}, view only): this is where the remaining fields live.
- Header buttons: **"Invite student to complete profile"** and **"Reassign staff member"**.
- Tabs: Profile (shows a ⚠ when incomplete), Search and Apply, Applications, Unpaid Applications.
- Section progress strip:
  - Personal Information ✓
  - Education Details ⚠
  - Test Scores ⚠
  - Additional Details ⓘ
- "New: Use WhatsApp to directly upload student documents, and we'll autofill the profile."
- **"Smart Document Vault":** "Upload your documents in bulk once. We'll auto-fill your Personal Information from your passport, your Education History from transcripts, and your Test Scores from English tests. Other documents like your resume, SOP, and visa will be stored for future applications."
- The full profile has about **34 required labels across about 59 inputs** (with one school and one test).
  - So ApplyBoard's total data burden is no smaller than GSP's. It is **split and deferred**: 6 fields to create the student, 2 to start an application, and the rest is filled later by document autofill, WhatsApp upload or the student.
- The Applications tab shows an AI nudge: "Our AI suggests that your success with [program] could be low or medium. For a better chance of success, please also consider applying to at least one of the programs we recommend below." The nudge includes a one-click "Create application".

### 2.4 Start a new application (program page → "Create application")

A single modal called "New Application". The stepper reads "Eligibility › Prerequisites › Backups › What to Expect", and an **Intakes** step is inserted once a student is chosen. A context card keeps Program / School / Student / Intake / Deadline in view the whole time.

| Step | What's on screen | Required | Interactions |
|---|---|---|---|
| 1 Eligibility | "Please select a student to check their eligibility for this program:" (search; options show "[ID] name email") | 1 | 2 + Next |
| | **Ineligible:** "Unfortunately, this student is not eligible to apply to the selected program for these reasons: • The student has not provided an english score / If this information is incorrect, please update the student's profile data in order to apply." + "Update profile data". Next is disabled. | | |
| | **Eligible:** "Student is eligible for this program." | | |
| 2 Intakes | "Select the academic intake:" with options "Jan 2027 · Open", "May 2027 · Likely open"…; the card adds "Deadline Jan 02, 2027" ⓘ and "⚠ Important Intake Details – Learn more" | 1 | 2 + Next |
| 3 Prerequisites | Amber: "Please review the following carefully. If the student does not meet these prerequisites the application will be cancelled." "Expand all / Collapse all"; 7 school rules (country GPA, education background, Grade 12 maths, combined credentials, conditional offer, GCE, IB), each cut off with "See more". No acknowledgement checkbox. | 0 | Next |
| 4 Backups | "Choose up to 10 backup programs in order of preference. These will be considered if your main program is not available." "Backup Programs (0/10)", "Add Backup Program" → inline list with "Filter by program or school" and "Only similar programs" ☑; each row has "Show Details" (level, tuition, success chance, tags) and "+ Add" | 0 (optional) | Next |
| 5 What to Expect | "Please carefully review the following. You will need to meet these requirements to successfully submit the application." The document list: Passport Copy, Grade 12 Transcript, Grade 10 Transcript, English Language Proficiency, Resume, two acknowledgements. | 0 | **"Create application"**: I stopped here and cancelled |

**Counts**
- From the program page: 1 modal, 5 steps, **2 required inputs (student and intake), 0 typed fields, about 11 interactions**.
- From an empty account, the end-to-end minimum is about 25 interactions and 8 required fields:
  - Add student: ~11 interactions
  - Search and open the program: ~3
  - Wizard: ~11

**Automatic checks**
- Eligibility against the profile.
- Intake open / likely-open status.
- Deadline.
- Backup suggestions.
- The document checklist for this school.

**Fees** do not appear in the wizard. Payment comes after creation (the "Unpaid Applications" tab, and the "Not Paid" status with a card icon in the list).

**Defects seen**
- The "What to Expect" titles show a raw template token: "Grade 12 Transcript for **{School}**".
- After clearing the student field, the context card still showed the previous student.
- The main program itself appears as a backup option.
- The program page says students may apply without an English test, but the eligibility check blocked a student for "has not provided an english score".

### 2.5 Application page (/applications/{id})

**Header**
- School, program title, "App ID:", "Main selected intake: January 2027, Open" ⓘ.
  - Tooltip: "The school is accepting applications! ApplyBoard will submit your application once all required documents are provided."
- "Manage App" menu: "See recommended programs", "Request Tuition Deposit Refund".
- "Share access".
- "Enable WhatsApp Alerts / Never miss an update".
- On scroll, the header shrinks to a one-line sticky bar.

**Stage tracker** (collapsible): "Application created ✓ › Application Started ✓ › Application Reviewed (By ApplyBoard) ✓ › Submitted to School ✓ › **Awaiting School Decision** › Admission Processing › Pre-Arrival › Arrival". The tracker shows no dates.

**"What to do" banner** (amber, full width): **"Review on hold - Provide missing information to proceed"** + **"Complete Now"**.
- On this record it contradicts the tracker, which already shows "Submitted to School ✓".
- "Complete Now" did nothing visible, because the page was already on Requirements.

**Left panel** (collapsible, or an "Information panel" button on mobile)
- [student] card with "1 application" link.
- "Submission deadline: Jan 2, 2027".
- "Success score: Low 1%" ⓘ + "See recommended programs".
- Loan cross-sell card.
- Accordions:
  - "Application details" (intake, program, level, delivery method, required level, deadline)
  - "Student"
  - "Exams"
  - "Payment details" (Application fee, Payment status "Paid", date, "Download receipt")

**Requirements tab**
- Quick chips **All · Pending · Approved · Rejected · In Review**, plus a Filters menu:
  - Requirement status: Rejected / Pending / In Review / Approved
  - Requirement state: Required / Optional / …
- Items are grouped in collapsible sections: "Pending (5)", "Approved (8)".
- Each item shows the document type and the school's own instruction (e.g. "Degree transcripts for [institution] | Kindly Provide Bachelors Transcripts (Complete)…"), an "Upload" button and a kebab ("View details", "Copy requirement link").
- **Optional items carry "Optional now, required later" ⓘ and an "Optional" tag.**
- "Complete your profile" is itself a requirement, and "Apply for a Student Loan" appears as an optional requirement (cross-sell).

**Upload**
- "Upload Documents": "Please provide the necessary document so the school may issue a decision for this application", "Please upload a valid document ✱", "Submit".
- No category picking is needed, because the requirement already defines the document type.
- Upload is about **3 interactions**.

**Student records tab:** a timeline with UTC times.
- "Application has been submitted: This application was submitted on 6 Oct, 2026 at 23:30 UTC."
- **"Application Package Submission Proof"**: screenshots, SubmissionProof.pdf and the receipt.
- "Application has been evaluated for submission".
- "Application is Ready for Evaluation: All mandatory documents were received on…"
- "Application Opened".

**Notes tab**
- "Take action" menu: "Create note", "Start Live Chat".
- **"Notes Summary"** (AI): a summary paragraph, then
  - **"Student / Applicant Needs To:"** with bullets
  - **"ApplyBoard / Institution Needs To:"** with "No pending action identified."
  - "Generated on October 6, 2026 at 4:26 PM", "Translate", "Regenerate"
- **The summary was stale.** It described an earlier, cancelled program choice. The newest note (12 Oct) asked for two transcripts.
- Note cards show the staff author's avatar and name, a title ("Application Update: This application requires additional information!", "Application Submitted", "Application in Queue", "Missing Documents", "Student not Qualified") and a timestamp.
- The body includes a "Note" callout that lists the items. Raw markdown "**" shows in monospace.

**Commission tab**
- "Actual commission received may vary based on several factors…"
- **"Effective commission rate: 75%"** ⓘ
- **"Final estimated commission: 15.00% of net (base) tuition fee"**
- **"Max number of installments: 3"**
- "Commission eligibility: Pending"
- "Eligibility reason: --"
- "Effective commission history"
- No currency amount is shown.

**Share access** ("Self-serve student access")
- Text: "By providing the student with direct access to ApplyBoard, you'll still be able to see and modify any changes they make. The student will NOT be able to access the commissions related information or receive and view any notes from ApplyBoard. Once access is shared with the student, it cannot be revoked."
- Declining opens a second modal, "Before you leave…", which is a feedback survey. One option reads "I want a white labelled solution/I'm worried about telling my students that I work with ApplyBoard".

**Case owner:** no ApplyBoard owner is named on the application. Staff names appear only as note authors. The agent-side owner exists ("Reassign staff member", "Assignee" on tasks).

### 2.6 Applications list (/applications)

**Banner:** "Exciting update! Announcing Task Management…" / "Try Task Management".

**Buttons:** "Apply Filters", "Filters", "+ Add Application".

**Grid**
- Columns: Payment date (from/to), App ID, Student ID, Apply date, First name, Last name, Program, School, Start date, Recruitment partner, **Status**, **Requirements**, **Current stage**, each with its own filter. "1 - 18 of 18".
- Status chips: "Submitted", "Not Paid" (+ card icon to pay), "Cancelled", stacked "Accepted" + "Withdrawn".
- **Requirements:** four coloured count circles (e.g. 🟠2 🔵0 🔴0 🟢0) with **no legend and no tooltip**. The column filter reveals their meaning: "Missing", "Reviewing", "Reviewing - None Outstanding", "Not Approved", "Complete".
- Current stage chips: Pre-Payment, Pre-Submission, Submission, Post-Submission, Admission.

**Filters panel**
- School country; Payment status (Paid yes/no).
- Application status yes/no for: Accepted, Rejected, Canceled, Withdrawn, Refund In Progress, Program Closed, Deferral In Progress, Waitlisted, Ready to Enroll, Enrollment Confirmed.
- "Columns" tab with show/hide eye icons.

**Missing**
- Export.
- Bulk select and bulk actions.
- Intake, owner and commission columns.
- A "next action" column.

**Row kebab:** "View Application" opens a new tab.

### 2.7 My Tasks (/tasks)

**Banner:** "Don't miss your next deadline! Enable WhatsApp notification…"

**Header:** "You have 18 uncompleted tasks".

**Filters (8):** Intake, Due date, Application ID, App stage, Student, School name, School country, **Assignee**.

**Second row**
- "Showing 18 out of 18 uncompleted tasks".
- **"Hide overdue tasks" toggle, on by default.**
- "Due date type" ⓘ: School due dates / Suggested due dates / All due dates.
- "Task status": Uncompleted / Completed / All.
- "Task type": App requirements, At risk apps, GIC offers, Loan offers.

**Cards** (3 per row, each with a large decorative "App Requirement" header)
- "Due date" ⓘ with the chip **"Due date coming soon"**.
  - Tooltip: "A deadline for this task is currently being calculated. Please check back later for an update."
  - **All 18 tasks showed this chip; none had a real date.**
- Requirement title (link), Intake, App ID, Student, School, **Assignee**.

**Missing:** sort, grouping by student or urgency, and bulk actions.

**WhatsApp alert option:** shown in the banner here, on the application header, on Home and in Notification Preferences.

### 2.8 Commission, payments, wallet, Elevate

**Payments › Purchases**
- "Account Balances":
  - "Commissions $0.00 CAD" ⓘ: "This balance is withdrawable. It can also be used to make payments within ApplyBoard."
  - "ApplyCredits $0.00 USD" ⓘ: "This balance can be used to make payments within ApplyBoard. It is not withdrawable."
- "Order History" with search (student or order ID), date range and amount range.
- Rows: date, student, description, amount. Each row expands to "ORDER DETAILS / ORDER ID" and "View your full receipt here".
- Long descriptions overflow the row borders.

**Payments › Commissions** (the ledger)
- Search, dates, **"Transaction Types"**: Commission Earned, Bonus Commission, Commission Adjustment, Commission Deduction, Advanced Commission Deposit/Repayment, Loan Incentive, FX Incentive, Promotion Bonus, Commission Withdrawal Return…
- Columns DATE / STUDENT / DESCRIPTION / **CREDIT / DEBIT**, e.g.:
  - "GIC Incentive: Quantity: 1" (credit)
  - "commission withdrawal -- INV CW…" (debit)
- **No Withdraw button was shown at a $0 balance**, so the withdrawal flow could not be seen. There is no view of expected or pipeline commission.

**Per-application commission:** the application's Commission tab (§2.5).

**Program-level commission:** the program page (§2.2), and My Account › Commissions › "Institution Commissions".
- Filters: school group, country, level, commission type, commission range, max instalments.
- Rows show e.g. "11.25% of net tuition", "7.14–10.72% of net…", "Max inst." and "Comments".
- The table appears to show the **agent's net share** (75% × 15% = 11.25%), while the program page shows **ApplyBoard's gross rate** (15%). That is the same number framed two ways.

**Elevate (/elevate)**
- Tier table:

  | | Gold | Platinum | Titanium |
  |---|---|---|---|
  | "Base Commission for Enrolment" | 75% | 80% | 85% |
  | "Commission on Student Loans" | 1% | 1.10% | 1.25% |
  | "Core Processing Speed" | Standard | 4x | 8x |
  | "Support Response Turnaround Time" | Standard | 4x | 8x |
  | "Dedicated Account Manager" | Standard | Strategic | Strategic |

- "How to earn points":
  - Applicants from India, Nigeria, Ghana, Iran, Uzbekistan: **10 pts** (15 at a Prime school) per student "Committed to enroll".
  - Other nationalities: 20 / 25 pts.
  - "*Committed to enroll = 'Ready for Visa' status for all non-US destinations, 'Enrolled' status for US".
- "Here's Your Roadmap To Platinum Status": "You will need 300 more Elevate Points".
- So the formula is fully visible: **agent payout = tier % (75–85%) × school rate (e.g. 15% of net base tuition), paid in up to 2–3 instalments.**
- Wording conflict: My Account says status "depends on the number of final offers received", while Elevate says points come from students "Committed to enroll".

**Offers Dashboard**
- "Every Recruitment Partner now earns at least 75% commission… Earn more points to unlock up to 85%."
- Fee-waiver and UK special-commission promos.
- Cards per destination like "Earn CAD $400/Student enrolled", with dates, intake, "View Details" and "Read Guide".

**Invoices:** only a withdrawal invoice reference appears in the ledger. No invoice upload or generation screen was found.

### 2.9 Notifications and messages

**Bell** → /important_updates (a full page, not a dropdown).
- Banner: "Please note the 'Missing Requirements' tab was deprecated…"
- Tabs: **"Notes" (badge 67)** and **"Application Status"**.

**Notes tab**
- Bulk bar: "Trash Selected", "Mark as Read", "Mark as Unread".
- View: "All / Unread / Unread First / Trashed".
- Columns: Date & Time, Student ID, names, App ID, Program & School, Title (with preview: "Title: Application in Queue / Note: Hi [agent], …"), "View".
- Unread rows are bold.
- **Default order is oldest first**: 2023 notes sit at the top.

**Application Status tab:** App ID, Student, Program, School, **Current status, Previous status**, Date, View. For example "Submitted" ← "Ready to Su…", "Cancelled" ← "Reviewing".

**Counts disagree:** the banner says 69, the Notes badge says 67.

**Messaging**
- No two-way inbox. Replies go through "Create note" or "Start Live Chat" on each application, or live chat / WhatsApp from Home.

**Notification Preferences** (My Account)
- Each type has its own frequency (Defaults / Immediate / Daily / All off).
- Applications ("Fine-tune 8 notifications"):
  - New requirement
  - Rejected requirement
  - **Deadline in 24 hours**
  - **Deadline in 7 days**
  - **At-risk applications** ("when we detect an application has a low probability of converting")
  - **Tuition deposit reminder** ("Reminders 7, 3 and 1 days before the tuition deposit deadline, until the receipt is uploaded.")
  - Notes ("CC me on staff emails")
  - Replacement applications
- Commissions: "Earned, adjusted, withdrawn, and returned commissions".
- Offers for your students.
- "Add WhatsApp number" adds WhatsApp as a channel.

### 2.10 Team and account (/profile)

**Tabs:** Profile Information · Business Information · Commissions · Manage Staff · Notification Preferences.

**Profile:** legal name, email, password, phone numbers. An Indian number displays a Canadian flag.

**Manage Staff**
- Inline invite with First Name ✱, Last Name ✱, Email ✱ and "Invite". There is no role picker at invite time.
- "Invited Staff Members" (status).
- "Approved Staff Members" with **Profile** and **Payment** permission columns.
- Ownership: "Reassign staff member" on the student, "Assign Students to…" on bulk import, and "Assignee" on tasks.

### 2.11 TrainHub and updates

- **TrainHub:**
  - Search ("Search for schools or courses").
  - "Basics of ApplyBoard" courses with progress %: My Profile, Dashboard, Task Management, Managing Student Profiles, EWallet, ApplyBoard 101, Creating an application, a Spanish course.
  - "The Ecosystem" (compliance, ethics).
  - "Institution Training".
  - Courses open in a new tab.
- **Updates:** on-page banners announcing features ("Exciting update! Announcing Task Management…", "'Missing Requirements' tab was deprecated…"), "New" badges throughout, and promo modals on Home.
- **Invite Students:**
  - Intake form link, QR code ("Download PNG", "Copy link"), embed code, embeddable search, "Student Access Portal".
  - The form is "currently disabled", and has to be enabled first.

### 2.12 Mobile (about 400 px)

- No horizontal page overflow on Home, Search, Applications or the application page.
- Navigation becomes a hamburger drawer, which **does not close after choosing a page**.
- **Application page:** well adapted.
  - Icon buttons replace the header actions.
  - An "Information panel" button holds the side panel.
  - The tracker scrolls sideways.
  - The amber banner has a full-width "Complete Now".
  - Requirement cards stack, with full-width "Upload".
- **Search:** adapted.
  - "Smart filters" and "Sort & Advanced Filters" buttons.
  - Institution and quick filters are hidden.
- **Applications list:** not adapted. The desktop grid is squeezed so only Actions and Payment Date show; status and stage need a sideways scroll inside the grid.
- **Home:** one KPI card per row, so the page is about 4,400 px long.
- A direct load of /applications once returned "ERROR 404 Page Not Found". The same page loaded fine from the menu.
- The floating chatbot covers kebab buttons on the right edge.

---

## 3. Comparison per flow (ApplyBoard vs GSP)

GSP numbers come from the GSP Admin, BOA, COU and HOA audits (the "~80 interactions / ~27 required" baseline).

| Flow | ApplyBoard screens | ApplyBoard required / total fields | ApplyBoard interactions | GSP screens | GSP required / total | GSP interactions |
|---|---|---|---|---|---|---|
| Search → open a program | 1 page + 1 tab | 1 / 1 (keyword) | ~3 | 1 page + card view | 2 used of 17 inputs | ~8 |
| Eligibility check | Inside the wizard, or 1 modal (guest) | 1 (student) or 1 of ~7 (guest) | 2 (student) / ~8 (guest) | Not available as a check | – | – |
| Add student | 1 modal | **6 / 15** | ~11 | 1 long form | **18 / ~44** | ~46 |
| Start application (student exists) | 1 modal, 5 steps | **2 / 2 + optional backups** | ~11 | Enrolment + Application steps | ~9 required | ~21 + modals |
| **New student → application created** | 2 modals + search | **8** | **~25** | 4 steps, 6 modals | **~27** | **~80** |
| Complete profile before submission | 1 page (autofill, invite student, WhatsApp) | ~34 / ~59 (deferred, can be delegated) | varies | Already in the 27 above | – | – |
| Upload a requested document | Modal from the requirement row | 1 file | ~3 | Documents tab → kebab → Add Record | file + Category + Sub Category | ~7 |
| Find what's missing on an application | Application page, Requirements tab (open by default) | – | 1–2 | Not shown | – | n/a |
| See commission for an application | Application page → Commission tab | – | ~3 | My Commission → bucket → item → transaction (hidden for counsellors) | – | ~4 / denied |
| Compare and share programs | Toggle + 2 checkboxes + Compare → Share link / Excel | – | ~5 | Not found | – | – |

**Takeaway:** ApplyBoard doesn't ask for less data overall. It reaches a created application with **about 70% fewer interactions and about 70% fewer required fields** by:
- deferring everything not needed for eligibility,
- autofilling from documents,
- letting the student fill their own profile.

---

## 4. Status and ownership language (quoted)

**Stage tracker (application page)**

"Application created" → "Application Started" → "Application Reviewed (By ApplyBoard)" → "Submitted to School" → "Awaiting School Decision" → "Admission Processing" → "Pre-Arrival" → "Arrival"

**List "Current stage"**

"Pre-Payment" · "Pre-Submission" · "Submission" · "Post-Submission" · "Admission"

**List "Status" and filters**

"Not Paid" · "Submitted" · "Cancelled" / "Canceled" · "Accepted" · "Rejected" · "Withdrawn" · "Refund In Progress" · "Program Closed" · "Deferral In Progress" · "Waitlisted" · "Ready to Enroll" · "Enrollment Confirmed" · status history uses "Reviewing", "Ready to Su[bmit]", "Unpaid"

**Requirement states**

- "Pending" · "Approved" · "Rejected" · "In Review"
- List filter: "Missing" · "Reviewing" · "Reviewing - None Outstanding" · "Not Approved" · "Complete"
- "Optional now, required later" · "Optional"
- Prerequisites warning: "If the student does not meet these prerequisites the application will be cancelled."

**Who acts next (explicit)**

- Banner: "Review on hold - Provide missing information to proceed" + "Complete Now"
- Intake tooltip: "The school is accepting applications! ApplyBoard will submit your application once all required documents are provided."
- AI notes summary: "Student / Applicant Needs To:" … / "ApplyBoard / Institution Needs To:" "No pending action identified."
- Note text: "Please review the Requirements Tab and provide the necessary item(s) as soon as possible."
- Eligibility block: "If this information is incorrect, please update the student's profile data in order to apply." + "Update profile data"
- Upload modal: "Please provide the necessary document so the school may issue a decision for this application"

**Who acts next (implicit)**

- "(By ApplyBoard)" appears on one tracker stage only.
- "Awaiting School Decision" implies the school.
- Task "Assignee:" names the agent's staff member.
- "Reassign staff member" sets the agent-side owner.
- **No ApplyBoard case owner is named** on the application.

**Timing language**

- "Main selected intake: January 2027, Open"
- "Open" / "Likely open"
- "Submission deadline: Jan 2, 2027"
- "Due date coming soon" (with "A deadline for this task is currently being calculated. Please check back later for an update.")
- "Deadline in 24 hours" / "Deadline in 7 days"
- Timestamps in UTC in Student records

**Risk language**

- "Success chance: High" (with a breakdown)
- "Success score: Low 1%"
- "Our AI suggests that your success with [program] could be low or medium…"
- "At-risk applications … low probability of converting"

---

## 5. Top 15 strengths, ranked by time saved for a busy counsellor

1. **Split data entry: 6 required fields to create a student, 2 to start an application.** This cuts about 55 interactions from GSP's ~80-step path. Everything not needed for eligibility is deferred.
2. **Inline eligibility check with the exact blocking reason.** "The student has not provided an english score" + "Update profile data" stops doomed applications before any fee or document work.
3. **The requirement checklist is the to-do list.** "Pending (5) / Approved (8)" sits on the application with a one-click "Upload" per item. There is no category picking and no guessing what's missing.
4. **Document autofill.** "Autofill with passport", the "Smart Document Vault" (passport → personal, transcripts → education, test reports → scores) and WhatsApp upload remove most typing.
5. **"Invite student to complete profile" / "Share access".** The ~34 remaining fields can be pushed to the student, while commission and notes stay private.
6. **An explicit next-action banner.** "Review on hold - Provide missing information to proceed" + "Complete Now", at the top of the application.
7. **AI Smart filters that tolerate typos.** One sentence becomes 5 removable filter chips.
8. **The application wizard shows school-specific rules before creation.** Prerequisites, deadline, intake status and the document list ("What to Expect") prevent rework and cancellations.
9. **Notes summary with an owner split.** "Student / Applicant Needs To" vs "ApplyBoard / Institution Needs To", with Translate. It saves reading 5+ notes, when it is current.
10. **Commission is visible everywhere at the moment of decision.**
    - Sort by Commission, plus the "Show commissions" card toggle (off by default, for screen-sharing).
    - The program page rate and instalments.
    - The per-application Commission tab.
    - The Elevate tier table, which makes the formula explicit.
11. **Guest eligibility search.** "a guest student (with no profile yet)" needs 1 required field, so a walk-in can be advised before any record exists.
12. **Compare with share.** "Share link", "Share Excel over email" and "Download" send a counsellor's shortlist to the student in seconds.
13. **"Optional now, required later" labelling.** The counsellor can submit early without losing sight of what's coming.
14. **Submission proof and timestamped records.** "Application Package Submission Proof" with PDF and screenshots, plus UTC event times, answers "did it really go?" without a support ticket.
15. **Per-type notification control, including WhatsApp.** Deadline 24 h / 7 d, at-risk, tuition-deposit reminders (7/3/1 days) and new or rejected requirement alerts can each be set to Immediate or Daily.

---

## 6. Top 10 weaknesses

1. **Due dates don't exist in practice.** All 18 tasks showed "Due date coming soon", and "Hide overdue tasks" is **on by default**, so the most urgent items are hidden.
2. **Signals contradict each other on the same application.** The tracker shows "Submitted to School ✓" while the banner says "Review on hold", and the AI summary (6 Oct, about a cancelled program) disagrees with the newest note (12 Oct).
3. **No ApplyBoard owner on the application.** Staff appear only as note authors. "Who do I chase?" means live chat or the account manager.
4. **The requirement count circles in the list have no legend or tooltip.** Four coloured numbers can only be decoded through the column filter.
5. **Commission is framed two ways** (15% gross on the program page vs 11.25% agent-net in the commission table). No currency estimate appears anywhere. There is no view of expected or pipeline commission, and tier wording conflicts ("final offers received" vs "Committed to enroll").
6. **Marketing interrupts work.**
   - 2 modals on Home load.
   - Loan, GIC and 360 cards on the application page.
   - "Apply for a Student Loan" listed as a requirement.
   - A feedback survey after declining "Share access".
7. **The applications list and My Tasks are weak for volume work.**
   - No export, bulk actions or sort on tasks.
   - Oversized task cards.
   - Oldest-first notifications.
   - The list on mobile is a squeezed desktop grid.
8. **Search is not typo-tolerant outside the AI box**, and Institution misspellings return nothing with no message. Search also takes about 10 s to load.
9. **Data quality gaps.**
   - The DOB mask silently rejects DD/MM.
   - No discard warning on Cancel.
   - Last names saved as "." or as the email.
   - "{School}" template tokens.
   - Raw "**" markdown in notes.
   - "Unknown" and past deadlines in Compare.
   - TOEFL "1.0" placeholders.
   - 69 vs 67 update counts.
10. **New-tab sprawl and long modals.** Program, student, application, compare and task links all open new tabs. The prerequisites step is 7 dense legal blocks with "See more" and no summary.

---

## 7. What couldn't be checked and why

| Item | Reason |
|---|---|
| Saving a student, duplicate detection, server-side validation | Needs a save; read-only rule |
| Passport autofill accuracy | Would upload an identity-type document to production OCR |
| Bulk CSV import results and error handling | Needs an upload and save |
| Final "Create application", fee payment screen, payment methods | Final step not clicked; payment forbidden |
| Document upload, rejection and re-upload cycle | Needs an upload |
| Creating a note, live chat, replying to staff | Would message ApplyBoard staff |
| Share access / student portal experience | Irreversible ("cannot be revoked") and notifies the student |
| Withdrawal flow, invoice generation | Balance was $0 and no Withdraw button showed; also forbidden |
| Instalment schedule and actual payout amounts | No commission-earning record in this account |
| Saved filters, Display settings "Show commissions" | Both would write preferences |
| WhatsApp alerts setup | Would register a phone number and send messages |
| Notification preference changes and saving behaviour | Would change account settings |
| Staff invite and role permissions | Would send an invite |
| "Regenerate" on the AI notes summary | Writes a new summary |
| Due-date calculation | No task in the account had a calculated date |
| Wish List page contents | Not opened, to keep time on the core flows |
| 360 Solutions, GIC and loan application flows | Outside scope; would start a third-party service |
| "Job Insights" tab and "Convert grades" tool | Seen but not opened |
| Accessibility (screen reader, keyboard-only, contrast) | Not in this brief |
