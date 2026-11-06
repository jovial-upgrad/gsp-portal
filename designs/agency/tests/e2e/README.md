# Browser tests (Playwright)

Each suite opens the built prototype (`dist-artifact/index.html`), clicks through one area as a person would, and prints one `PASS` or `FAIL` line per check, then `N passed, M failed`.

```bash
cd designs/agency
npm run build:artifact               # the suites test the built file
node tests/e2e/consistency.cjs       # or any suite below
GSP_URL=file:///path/to/index.html node tests/e2e/work.cjs   # test another copy
```

They need Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`, or a global install. They're `.cjs` because the package is an ES module.

| Suite | What it checks | Status, 5 Nov 2026 |
| --- | --- | --- |
| `consistency.cjs` | In all five roles, pop-ups have the close icon at the top right and their buttons at the bottom right, and no browser-native dropdown is visible | 55/55 |
| `work.cjs` | GSP · Admin › Work: the menu; the Queues tab (groups, search, filter, Create, Edit, Delete); Kinds of Work; Working Days (calendars); Reminders and Escalation; Task Rules; My Work | 85/85 |
| `mail-thread.cjs` | Inbox, every GSP role: the sample thread in the list, folded and expanded, search inside it, a reply joining it | 20/20 |
| `primary.cjs` | A student's primary application (6 Nov): Primary or Secondary on every row in RP Admin, GSP · Admissions, GSP · Admin and GSP · Institution (one Primary per student); Mark as Primary only for Admissions and Admin, asked first, and the list follows | 30/30 |
| `seats.cjs` | GSP Branch Manager and GSP Counsellor: menu, who's signed in, Find courses without commission, their students only (3 for the Mumbai branch, 1 for the counsellor), Students and Applications editable, an application's Chat, Documents and Logs without commission | 24/24 |
| `rpadmin-access.cjs` | RP Admin against the 6 Nov access sheet, and its backup role looking the same: menu, Find courses with commission, Students and Applications editable, an application's Chat, Documents and Logs with commission shown | 18/18 |
| `instops.cjs` | GSP · Institution Ops from the access sheet: menu (no Students, Applications, Recruitment partners, Master Partners), Course search without commission, student picker, shortlist or Apply, Institution partners view only, Universities, Courses and Announcements editable | 24/24 |
| `institution-access.cjs` | GSP · Institution against the 6 Nov access sheet: menu with Master Partners; Inbox, Students, Applications (no Documents or commission), Recruitment partners, Master Partners, Courses and Announcements view only; Course search without commission; Institution partners and Universities editable | 40/40 |
| `rpops-access.cjs` | GSP · RP Ops against the 6 Nov access sheet: menu with Institution partners, Inbox, Students and Applications view only, no commission in Course search or on applications, Recruitment partners (Commission too), Master Partners and Institution partners editable | 27/27 |
| `recruitment.cjs` | GSP · Recruitment from the access sheet: menu (no Inbox, Universities, Courses, Announcements), My work and Course search usable, Students and Applications view only with Chat usable, Recruitment partners editable with branches and team, documents and commission view only, Master Partners and Institution partners view only | 35/35 |
| `admissions-access.cjs` | GSP · Admissions against the 6 Nov access sheet: menu (no Earnings, Profile, Master Partners, Institution partners, Announcements), E pages usable, commission gone, Recruitment partners, Universities and Courses view only | 33/33 |
| `globalops.cjs` | GSP · Global Ops, row by row from the access sheet: menu, brand, user; each E page usable, each V page and section view only, each – section gone (commission, RP documents, branches, team, MP documents and commission, IP commission, Update QS ranking) | 43/43 |
| `finance.cjs` | GSP · Finance: menu, brand and user; Inbox, My work, Students (documents view only) and Course search (no commission) usable; Applications with only Commission and Logs, commission edited and saved; Recruitment partners and Master Partners view only but Commission; Institution partners, Universities (no QS, Scholarships, Territory, Submission) and Courses view only | 53/53 |
| `view-only.cjs` | GSP · View Only: GSP · Institution's menu, the brand and who's signed in, every page and every record tab with nothing to change and the view-only line, Course search working, GSP · Institution unchanged | 73/73 |
| `inbox-cats.cjs` | Inbox categories in GSP · Admissions: the Category dropdown and counts, Not linked only, the nudge's errors, Link and Forward, Forwarded and Others | 12/12 |
| `inst-work.cjs` | GSP · Institution › My work: views, empty states, breached first, Queues filter, tick and assign | 11/11 |
| `rpops-work.cjs` | GSP · RP Ops › My work: views, empty states, Queues filter, tick and assign | 10/10 |
| `gsp-work.cjs` | GSP · Admissions › My work: views, tiles, paused and dated SLAs, Mark as completed, filters, tick and assign, Waiting on others | 15/15 |
| `news.cjs` | Announcements and Summarise on every university's tab, in every role | 17/17 |
| `courses.cjs` | RP Admin's Find courses: search, filters, sort, shortlist, the course pop-up | 63/64: the university link now opens the course page (an intended change) |
| `apps.cjs` | RP Admin's Applications: list, tiles, filters, the application page, Add an application | 135/136 |
| `nat.cjs` | GSP · Admin's Nationality Map and its link to routing | 20/21: the map changed on 4 Nov (nationalities added and deleted) |
| `onb4.cjs` | RP Admin's onboarding: Become a partner, the GSP contact, documents, the agreement, Home as a summary | 47/52: the city picker and Home changed on 4 Nov |
| `rpops.cjs` | GSP · RP Ops: role, menu, Recruitment partners (overview, branches, documents, the agreement), Master Partners | stops part-way: RP Ops now opens on Home, and fields moved |
| `admin.cjs` | GSP · Admin's configuration pages (Title Case, Edit then Save Changes, pages, Logs) | 85 checks; 6 Nov: brought up to date (State and City, three access levels, Logs as a table), the role and multi-select region filters, program level Edit |
| `roles.cjs` | The Role switch and each role's portal | stops part-way: the roles are now called GSP · Admissions and GSP · RP Ops |
| `gsp-app.cjs`, `inbox.cjs`, `inst-parity.cjs` | GSP · Admissions' application page; the Inbox; GSP · Institution against GSP · Admissions | stop part-way, for the same renames |

On the other session's branch on its own, the failing suites give the same results, so they're out-of-date expectations rather than bugs. Update them first, one suite at a time:
1. Run the suite.
2. Check each failure against the change in `REVIEW.md`.
3. Fix the selector or the expected text.
4. Rerun.

Two more things to know:
- **Dropdowns:** every select is the product's dropdown, with a hidden native `<select>` underneath, so `page.selectOption('#id', value)` still works. Focus lands on the visible button, `#id-field`.
- **Load:** run suites one at a time. Running them alongside other browser scripts can make timing checks fail.
