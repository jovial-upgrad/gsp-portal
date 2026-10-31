# Agency side: design and build plan

**Project:** upGrad GSP 3.0 · agency (recruitment partner) portal
**Owner:** Nesil Noble · **Drafted:** 25 Oct 2026 · **Go-live:** 15 Dec 2026
**Status:** in build. Decisions recorded in section 8 (25 Oct 2026). Sign in, forgotten password and becoming a partner (a short form, the email code, then the business details and documents in the portal) are built; see `README.md`.

---

## 0. In short

We design and build the whole agency side as one coded, clickable prototype in `designs/agency/`. We start where an agency starts: **joining GSP and getting set up**. That covers sign-up, documents, GSP's check, the agreement, bank details and the team. After that come the daily screens: Home, Applications, Students, Find courses and Earnings.

What changes most from the PM prototype:

1. **One frame from the first minute.** A new agency gets the real portal straight away, with locked areas that say what opens them. Today the prototype puts it in a separate "Join GSP" portal with different tabs.
2. **A shorter sign-up.** Six typed fields and an email code, against about twelve fields today.
3. **Setup as a checklist on Home.** Each step shows who has it, how long it usually takes and what it unlocks.
4. **AI that prevents send-backs.** It names and sorts business documents, catches the wrong file, and checks names match before GSP ever sees them.
5. **The BDM visible from minute one,** with WhatsApp and phone.
6. **Role scoping everywhere,** including money. Today the prototype shows a counsellor the agency's full earnings and bank details.

---

## 1. Who we're designing for

| Role | Sees | Does | Notes |
| --- | --- | --- | --- |
| **RP admin** (agency owner or head office) | Everything in the agency, all branches | Signs up, uploads business documents, signs the agreement, adds bank details, manages branches and team, applies, earns | The only role that can sign the agreement or change bank details. Today's portal gives the agency head no branch view; we need one. |
| **Branch admin** (branch manager) | All students and applications in their branch | Applies, uploads, chats; invites counsellors to their branch | Can't change branches, bank details or the agreement. |
| **Counsellor** | Only their own students and applications | Applies, uploads, chats | Mostly on phones in the field. Money visibility is decision 2 in section 8. |
| **Invited team member** (any role, first visit) | The invite and then their role's view | Accepts the invite, sets how they sign in, adds WhatsApp | Can only search courses until the agency is activated. |
| **Student** (doesn't sign in) | A self-fill link and a document upload page | Fills their own profile and uploads their own documents | Never sees commission or notes. |
| *Master Partner admin* | — | — | Later; not in this plan. |

Scale to design for: an agency can have hundreds of students and applications (Unilink Dhaka has 440 students and 858 applications), several branches and dozens of counsellors.

---

## 2. The agency's journey, end to end

```text
Find GSP → Sign up → Set up ───────────────────────────────→ Daily work ─────────────→ Get paid
            │        │ Upload business documents   (agency)    │ Add students             │ Expected → Confirmed
            │        │ GSP checks them             (GSP, ~1d)  │ Find courses             │ → Invoiced → Paid
            │        │ Sign the partner agreement  (agency)    │ Apply, upload, chat      │ Weekly self-billed
            │        │ Add bank details            (agency)    │ Track 8 stages           │ statement, tier top-ups
            │        │ Invite the team             (any time)  │
            └ Course search is open from the first minute
```

### Agency account states

From the brief, plus the prototype's state machine, with each state's owner colour and what the agency can do.

| State | Who has it | Banner says (draft) | Search courses | Team | Students and applications | Earn commission |
| --- | --- | --- | --- | --- | --- | --- |
| **Not activated** | Agency (amber) | "Upload your business documents to open students and applications" | ✓ | ✓ invite (search only) | Locked | Locked |
| **Checking** (BAP verifying) | GSP (violet) | "GSP is checking your documents. Usually within 1 working day." | ✓ | ✓ | Locked | Locked |
| **Sent back** | Agency (amber) | "2 documents need replacing" + reasons | ✓ | ✓ | Locked | Locked |
| **Activated** | Agency (amber) | "Sign your partner agreement to start earning" | ✓ | ✓ | ✓ | Locked |
| **Fully active** (agreement signed) | Done (green) | none; Home switches to daily work | ✓ | ✓ | ✓ | ✓ |
| **Not approved** (BAP rejected) | — | "We couldn't activate this agency. [BDM] will call you to explain." | ✓ | — | Locked | Locked |
| **Suspended / Dormant** | — | "New applications are paused. Live applications carry on. Talk to [BDM]." | ✓ | ✓ | View only; no new ones | Existing lines only |

Timers from the brief: if documents aren't in after 3 days, the agency gets a reminder and its BDM is asked to call. BAP's usual turnaround is about 1 working day.

### Business documents by country

From the brief and the prototype's sign-up rules (`SU_DOCS`, `DOCRULES`).

- **India:** business registration certificate, PAN card, GST certificate (if registered). The partner agreement follows after activation.
- **Everywhere else (default):** business registration certificate, company profile, owner's ID, a business reference (name, email, phone).
- **Vietnam** (from the prototype's Saigon Bridge record): enterprise registration certificate, tax code certificate.
- Super admin can change these rules per country. The design must handle any list of 2–6 items.

BAP's send-back reasons (fixed): Not legible · Pages missing · Wrong document · Expired · Details don't match · Other (with a note).

---

## 3. What I'd change from the prototype, and why

The prototype is the behaviour reference; its visual style is a placeholder. These are the structural changes I propose.

| # | Prototype today | Proposal | Why (source) |
| --- | --- | --- | --- |
| 1 | After sign-up, the agency lands in a separate "Join GSP" portal (tabs Home, Documents, Profile, Find courses, Team). It switches to the main portal on activation. | **One shell from minute one.** Home, Applications, Students, Find courses, Earnings and Profile are always there. Locked ones say what opens them and roughly when. | Brief rule: "the frame never changes with the state". It also avoids a jarring switch at activation. |
| 2 | Sign-up asks for about 12 fields: name, business, country, state, city, email + code, phone, owner details, commissions email, how you found us, referral code. | **Six typed fields + email code:** name, business name, country, city, work email, WhatsApp number. Referral code sits behind "Have a referral code?". Commissions email moves to bank setup. Owner details and "how you found us" are deferred or dropped. | Brief: "one short sign-up form (name, business, country, email code)". README: ask only what's needed now. City stays because it decides the BDM (`BDM_RULE`). |
| 3 | The "What you can do" list shows Open / Locked chips. | **Setup checklist as the Home hero.** Five steps, each with an owner chip, "usually takes", what it unlocks and one action. Progress shows as "2 of 5 done". | Zeigarnik effect. Brief: "every screen says what to do now". It answers the agency's three questions during setup. |
| 4 | Documents upload one by one with no help. Mistakes are found only when BAP sends them back. | **Drop everything at once.** AI names and sorts each file, warns about the wrong document ("This looks like a GST certificate, not a PAN card"), and reads the key fields. It cross-checks business names before the documents go to GSP. Each item shows what a good file looks like. | Brief: AI names and checks files; warn, don't block. Field report: document confusion is problem #1 (14 of 27 sessions). It means fewer send-backs and a faster activation. |
| 5 | The agency is moved to "Checking" without being told when the last file goes in. | **A clear hand-off moment.** A success sheet with thumbnails of what was sent, who has it now (GSP, violet), how long it usually takes, and "We'll WhatsApp you". | People act; the system moves the status. Peak-end rule. Reference G-47. |
| 6 | The agreement is a modal with a checkbox. | **An agreement page.** A plain-words summary comes first: what you earn, tiers, weekly self-billed payouts, no claims, how to end it. The full text follows with key clauses linked. You sign by typing your name. The signed copy goes to Documents and email. Only the RP admin can sign. | Field report: unclear commission causes 3–4 trust queries a week. The agreement is the first place to fix that. |
| 7 | Bank details have fields per country, but the proof document isn't read. | **Bank setup as its own step,** with fields per country (kept from the prototype). AI reads the proof document (cancelled cheque or bank letter), prefills it and checks the name against the business. The commissions email moves here. It explains plainly why a later change pauses the next payout. | Removes manual typing; Finance only checks mismatches. Nepal banks need transfer receipts (field report), so receipts get a slot on payouts later. |
| 8 | Team and branches are solid: roles, a 7-day invite, resend, removal with student handover, owner transfer through the BDM. | **Keep the behaviour, redesign the surface.** Add the invitee's own accept flow. Add a branch roll-up for the agency head: counts per branch, filter by branch everywhere. | Legacy head office audit, problem #1: no branch view anywhere. Brief suggestion 7: smooth handover. |
| 9 | Counsellors see agency-wide earnings and bank details. | **Scope money by role.** See decision 2 in section 8. | Brief: each role sees only what it allows. Legacy hides commission from counsellors. |
| 10 | The BDM shows under "Contacts". | **The BDM card on Home from the first minute:** name, photo, WhatsApp, call, hours. The Admissions contact is added on activation. | Field report problem #9: "don't know whom to contact". Bangladesh praises one named person on WhatsApp. |
| 11 | Ask GSP is an empty box. | **Ask GSP is there from the first minute,** with suggested questions for the current state ("What's left before I can apply?", "Why was my PAN sent back?", "How much will I earn?"). Answers cite the source; the assistant never changes data and hands over to the BDM. | Brief: AI answers first, 9 in 10 questions. |
| 12 | Nothing explains what the portal can do. | **A short "How GSP works" card** (4 steps) on Home while setting up, and a light Updates and training feed later. | Field report: a partner since 2017 submits by email because it assumes heavy uploads. Some gaps are awareness, not features. |

---

## 4. Screens and states, in build order

Status against the PM prototype: **Keep** = behaviour is right, redesign the look · **Rework** = change the flow · **New** = not in the prototype.

### Wave 0: foundation (first, small)

| Item | What |
| --- | --- |
| Tokens | Colour (brand, neutrals, owner, status, AI), type scale (Figtree as the stand-in for CircularXX), spacing (upGrad `--uG` scale), radius, elevation, motion durations and easing, light theme first with tokens ready for dark |
| Logo | Redraw the chosen GSP lockup as SVG from the upGrad SVG we have; mark-only version for the collapsed sidebar and favicon |
| Shell | Left sidebar (Home, Applications, Students, Find courses, Earnings, Profile), bell, Ask GSP; mobile bottom nav |
| Components | Button, input, select, searchable select, phone input, 6-digit code input, owner chip, status pill, next-action banner, card, tabs with counts, table, checklist step, stage tracker, upload zone and file row, success sheet, modal and bottom sheet, toast, empty state, skeleton, AI panel and AI working state |
| System page | `/system`, a living style sheet of all of the above, for review |
| Prototype controls | Switch role, agency state, country, device frame; reset data. Every state is reachable by URL. |

### Wave 1: joining and getting set up (this request)

| # | Screen or flow | Roles | Status | References to start from |
| --- | --- | --- | --- | --- |
| 1.1 | **Join GSP**: the value in agency terms beside the sign-up form | Public | Rework | G-13 (welcome), upGrad DS two-tone heading |
| 1.2 | **Email code** inline: 6 digits, paste, resend timer, wrong or expired code | Public | Keep | — |
| 1.3 | **Duplicate checks**: email already in use (business already on GSP is out of the prototype, decision 13) | Public | Rework (toasts → screens) | G-45 |
| 1.4 | **Welcome**: account created, course search open, what happens next | RP admin | New | G-47 |
| 1.5 | **Home in setup mode**: setup checklist, BDM card, "while you wait" (search, how GSP works), Ask GSP | All agency roles | Rework | G-16, G-13, G-18 |
| 1.6 | **Locked areas**: Applications, Students and Earnings before activation, in the same frame | All | Rework | — |
| 1.7 | **Business documents**: list by country, drop-all-at-once, AI sorting and checks, per-item examples | RP admin | Rework | G-02, G-07, G-11 |
| 1.8 | **Sent to GSP** success sheet, then the **Checking** state | RP admin | New | G-47, G-36 |
| 1.9 | **Sent back**: each document with its reason and how to fix it; replace → back to GSP | RP admin | Keep | — |
| 1.10 | **Activated** moment: students and applications open, Admissions contact added | All | New | — |
| 1.11 | **Partner agreement**: plain-words summary, full text, Ask about it, type-to-sign, signed moment | RP admin (others read-only) | Rework | G-33 (fact strip) |
| 1.12 | **Bank and payouts**: fields per country, AI-read proof, name match, commissions email | RP admin | Rework | G-40 |
| 1.13 | **Team and branches**: invite, roles explained, statuses, resend, remove with handover, branches with BDM | RP admin, branch admin | Keep | G-09, G-21 |
| 1.14 | **Accept invite** (invitee): confirm details, sign-in method, WhatsApp, short orientation | Invited member | New | — |
| 1.15 | **Sign in**: username and password, forgotten password (code to email), "Become a GSP partner" entry. **Built.** Later: "not found" for out-of-scope links | All | New | — |
| 1.16 | **Not approved / Suspended / Dormant** states | RP admin | Keep | — |
| 1.17 | **Profile**: Business, Bank and payouts, Documents, Team and branches, Contacts, Notifications | Role-scoped | Rework | G-27 |
| 1.18 | **Mobile**: sign-up, setup Home, document upload, accept invite | All | New | — |

### Wave 2: daily work

Home (active agency): needs-you list, pipeline, earnings strip, branch roll-up for heads · Applications list (owner tabs, search, "2 days · usually 13", export) · Application detail (stage tracker, next-action banner, Summary / Documents / Chat / Activity, full-width chat) · act from the list · notifications bell and WhatsApp digest preferences · applications still in the old system.

### Wave 3: students

Students list (readiness, counsellor, reassign) · Add student (6 fields, passport autofill, consent, duplicate across agencies) · Student record (sections with "N to add", documents kept once, bulk sort, "From the student record") · Student self-fill link (a student-facing page) · Counsellor handover.

### Wave 4: find courses and apply

Search (5 required inputs, a plain-language box that fills them, typo-tolerant) · course card (fees, intakes "closes in N days", You earn, eligibility verdict with its reason, "Checked 30 Sep") · Student view switch · course detail · compare up to 5 · branded shortlist PDF · New application (eligibility → intake → documents → create, backups on hold) · near-miss alternatives.

### Wave 5: money and the assistant

Earnings (Expected / Confirmed / Invoiced / Paid / Clawed back, tier progress, rates per university, statements with receipts) · Ask GSP in full · chat translation (proposal).

---

## 5. Wave 1 in detail

### 5.1 Join GSP (sign-up)

- **Layout:** one page, desktop split. Left: why join, in agency terms (destinations covered, "You earn 70%, up to 80%", a named Admissions contact, "no claims: paid weekly", course search opens immediately). Right: the form. On mobile the form comes first and the value strip collapses above it.
- **Fields** (6 typed + code):
  1. Your name
  2. Registered business name
  3. Country (searchable; top markets first; sets the phone code, document list and bank fields)
  4. City (decides the BDM)
  5. Work email → Send code → 6-digit code inline
  6. WhatsApp number ("Your daily task list and updates come here")

  Optional: "Have a referral code?". Terms in one line under the button; no checkbox.
- **Target:** about 12 interactions and under 2 minutes, against about 12 fields and 20+ interactions in the prototype.
- **Checks:**
  - **Email already on GSP:** sign in instead, or ask your admin to invite you.
  - ~~**Business already on GSP:** a screen, not a toast.~~ Out of the prototype (decision 13).
  - **Matches a rejected agency** (same registration number or email domain): never shown to the agency; flagged to BAP.
- **After create:** a welcome sheet ("Welcome, Asha. Course search is open.") with three next steps, then Home.

### 5.2 Home in setup mode

- **Headline:** "Welcome, Asha. 3 steps to start applying." Two-tone and calm.
- **Setup checklist** as the hero card:
  1. Create your account ✓
  2. Upload business documents · *You* · unlocks students and applications after GSP's check
  3. GSP checks them · *GSP* · usually 1 working day
  4. Sign the partner agreement · *You* · unlocks commission
  5. Add bank details · *You* · needed before your first payout

  Optional: "Invite your team". Each step has one action button; done steps collapse to a tick.
- **Side column:**
  - **Your GSP contact:** BDM photo, name, WhatsApp, call, hours.
  - **While you wait:** search courses and see the "How GSP works" 4 steps.
  - **Ask GSP:** suggested questions for this state.
- **Same frame:** Applications, Students and Earnings show a locked empty state in place. For example: "Students and applications open when GSP has checked your documents, usually 1 working day after upload. [Upload documents]"

### 5.3 Business documents

- **List by country.** Each item shows what it is, an example thumbnail ("what good looks like"), formats (PDF or photo, up to 20 MB), and a status: Missing → Uploaded → Checking → Verified, or Sent back with a reason.
- **Drop all at once.** "Checking 3 documents…" shows a visible working state, then per-file results:
  - **Ready:** named and matched to a slot.
  - **Please check:** low confidence.
  - **Needs a type:** couldn't tell.
  - **Wrong document:** "This looks like a GST certificate, not a PAN card. [Use as GST certificate] [Choose another file]".
- **Read and cross-check:** the business name and registration number on each document are read and compared. "Name on PAN matches your registration certificate ✓" or "Name differs: 'BrightPath Overseas Pvt Ltd' vs 'BrightPath Overseas'". It warns but doesn't block.
- **When the last mandatory item is in,** the status moves to Checking by itself. A success sheet shows the thumbnails sent, GSP's turnaround and "We'll tell you on WhatsApp".
- **Checking:** violet banner; documents locked with "Checking"; a timeline of what happened.
- **Sent back:** amber banner "2 documents need replacing". Each shows its fixed reason, BAP's note and how to fix it. Replacing all of them sends everything back to GSP by itself.
- **No documents after 3 days:** WhatsApp and email reminder with the missing list. On the agency side this is a notification, not a screen.

### 5.4 Activated, then the agreement

- **Activated:** notification plus WhatsApp. On Home, step 3 ticks and the hero changes to "You can now add students and apply". The Admissions contact joins the contact card. This is one considered motion moment.
- **Agreement page:**
  - **Plain words first:** you earn 70% of GSP's commission on every confirmed enrolment; 75% from 10 enrolments a year and 80% from 30, backdated; paid weekly by a self-billed statement; nothing to claim; non-exclusive; how either side can end it.
  - **Full text** below, with the clauses the summary cites linked.
  - **Ask about this agreement:** AI answers cite clause numbers.
  - **Sign** by typing your full name and ticking that you've read it. Only the RP admin can sign; others see "Ananya, your admin, can sign this".
- **Signed:** a success moment ("You now earn commission on every enrolment"). Earnings opens; the signed PDF goes to Documents and by email.

### 5.5 Bank and payouts

- **Fields per country,** reused from the prototype: India IFSC; Bangladesh routing number; Australia BSB; UK sort code; a generic IBAN/SWIFT fallback. It also says which currency they're paid in.
- **Upload the proof first:** a cancelled cheque or bank letter. AI reads the account holder, number and code and prefills them as highlighted fields to confirm, then checks the holder name against the business name.
- **Commissions email** (moved here from sign-up): "Statements and receipts go here".
- **Change later:** "Changing bank details puts your next payout on hold until Finance checks them, usually 1 working day."

### 5.6 Team and branches

- **Team list:** person, role, branch, access status (Invited · expires in N days / Joined / Active, last signed in / Invite expired / Removed), WhatsApp on file.
- **Invite:** name, work email, WhatsApp, role (each with one line on what it can see and do), branch. The link works once, for that email, for 7 days. Resend, copy link, cancel.
- **Remove access** in one step, with "Move their 34 students and 51 applications to…". Nothing is deleted.
- **Branches:** add, edit and remove; removing moves the people, students and applications. Each branch shows its BDM. Head office sees counts per branch.
- **Owner transfer:** through the BDM, as in the prototype.
- **Accept invite** (invitee): "Ananya invited you to Horizon Overseas as a counsellor in the Pune branch" → confirm name → sign-in method → WhatsApp → a 3-card orientation → Home scoped to the role.

### 5.7 States and edge cases to design

- Wrong or expired email code
- Email or business already registered
- Invite expired or already used
- Invitee's email belongs to another agency
- Last RP admin can't be removed
- Removing someone who still has students
- Bank change during a payout week
- Agreement opened by a non-admin
- Rejected and suspended agencies
- Session expired
- A link outside your scope shows "not found", never "no permission"
- Slow network during an upload; a file too big; the wrong file type
- AI unsure (low confidence) or AI unavailable: manual fallback, never a dead end

### 5.8 AI in wave 1

Document naming and sorting, wrong-document warning, field reading and name cross-check, bank proof reading, Ask GSP, agreement Q&A.

Guardrails (README section 6):
- A text label and its own colour, never the bare sparkle or the indigo gradient.
- A working state for anything over about 400 ms.
- Evidence and confidence with every check.
- Always correctable.
- Every automatic step goes in the activity log.
- Never changes data on its own.
- Hands over to the BDM.

### 5.9 Motion in wave 1

From `animation-library-by-nesil`:
- **Micro-interactions:** 150–250 ms, ease-out in and ease-in out, `transform` and `opacity` only.
- **Code input:** each digit settles, with a shake on a wrong code.
- **Upload:** per-file progress, then a staggered "sorted into place".
- **Checklist:** a step ticks with a short draw.
- **Peaks:** one considered moment each for "Activated" and "Agreement signed" (a check draw plus "70%" counting up). No confetti storms.
- **Reduced motion:** fades only.
- **Tools:** Motion for React plus CSS.

### 5.10 How we'll know wave 1 works

- Sign-up: ≤ 6 typed fields, about 12 interactions, under 2 minutes.
- Every state answers "who has it, what do I do, what's next", in colour and words.
- The frame doesn't change from sign-up to fully active.
- The wrong document or a name mismatch is caught before GSP sees it, which should mean fewer send-backs.
- The BDM is reachable from the first screen.
- WCAG AA contrast, full keyboard use, and a screen reader announces state changes.

---

## 6. How it will be built

- **Where:** `designs/agency/`, a Vite + React + TypeScript app.
- **Structure:**
  - `src/styles/tokens.css`: CSS custom properties.
  - `src/components/`: the shared pieces.
  - `src/screens/`: one folder per screen.
  - `src/data/`: sample data modelled on the PM prototype's spec. That covers statuses and owners (`ST`), status order (`NEXT`), agency actions (`NEEDS`), sign-up documents (`SU_DOCS`), and BDM and Admissions routing (`BDM_RULE`, `ADM_SPOC`).
  - `src/proto/`: the prototype controls.
- **Sample data:** realistic and at real density. It continues the prototype's agencies (Horizon Overseas in India, Saigon Bridge in Vietnam) and adds a brand-new one (BrightPath Overseas) for sign-up.
- **Prototype controls:** a hideable panel to switch role, agency state, country (document list, bank fields, phone code) and device frame (desktop 1440 / phone 390), and to reset data. Every state has its own URL for review links.
- **Motion:** Motion for React and CSS transitions, following the animation library's rules.
- **Viewing:** I'll publish the built prototype as a private claude.ai page so you can click through without running anything. The source stays in the repo, and each review comes with desktop and mobile screenshots.
- **Per screen, the gsp-design workflow:**
  1. State the direction in a line or two: references used, what's changed and why.
  2. Build.
  3. Run a self-check against the GSP rules, accessibility and the copy.
  4. Hand to you for review.
- **Quality bar per screen:**
  - all states: empty, loading, AI working, error and success
  - role variants
  - WCAG AA and keyboard use
  - reduced motion
  - copy reviewed with the ux-writing skill

---

## 7. Visual foundation (proposal, settled in wave 0)

- **Base:** the upGrad design system. White and `#F9F9F9` surfaces; text `#000 / #333 / #666`; Figtree as the stand-in for the licensed CircularXX at 400/500 with −1% tracking; radius 8 on controls and 16 on cards; soft tinted shadows; two-tone headings with one red phrase on brand moments such as Join and success.
- **Owner colours** (brief, fixed), always with words: **amber** = with you, **violet** = with GSP, **blue** = with the university. **Green** = done, **grey** = closed, **red** = blocked or rejected.
- **AI:** its own hue, distinct from red, amber, violet, blue and green. I'll propose a deep teal, plus a "GSP AI" text label and its own glyph. No indigo gradient, no bare sparkle.
- **Logo gradient:** kept to the logo and brand moments; never on status chips.
- **Primary action colour:** decision 1 in section 8.

---

## 8. Decisions

### Made (25 Oct 2026)

| # | Decision |
| --- | --- |
| 1 | **Primary buttons are dark navy**, from the deep end of the GSP logo blue (`#0E2C4C`). upGrad red is kept for brand moments. |
| 2 | **Counsellor money visibility: keep what the PM prototype shows for now.** Revisit before Earnings is designed. |
| 3 | **Commission is earned only once the student enrols.** The copy says this wherever commission is mentioned. |
| 4 | **Logo: the stacked wordmark**, "upGrad" over "GSP". |
| 5 | **Registration keeps the PM prototype's sign-up fields.** Proposal 2 in section 3, the 6-field sign-up, is not taken. |
| 6 | **The joining flow:** the website's "Become an upGrad GSP Partner" opens registration in the portal → document upload → GSP checks the documents → full access. Course search is open while GSP checks. |
| 7 | **Light and dark themes**, light by default, with a visible Light / Dark switch on every screen. No "match my device" mode: the portal opens in light whatever the computer is set to. |
| 8 | **Sign in with username and password**, a forgotten-password flow, and "Become a GSP partner" on the same screen. Sign-in is the portal's front door. |
| 9 | **Liquid Glass for the control layer** (sign-in built with it, 25 Oct 2026). Light is still the default theme. The rules for the rest of the portal follow Apple's guidelines; see "Liquid Glass in GSP" below. |
| 10 | **Registration shares sign-in's scene.** Since 27 Oct 2026 it looks exactly like sign in: the same photo and statement, the same panel width, and no joining steps or progress beside the form. The old sidebar layout is retired for joining. |
| 11 | **All required business documents before the portal opens.** The rules (PDF, JPG or PNG, up to 20 MB) are shown before upload. Once sent, the portal opens with course search; the rest opens after GSP's check. |
| 12 | **The portal opens while GSP verifies, with the rest locked in place** (26 Oct 2026). Home leads with "Document verification in progress", the date to expect it, and what GSP verifies (the business and its documents). Students, Applications and Earnings keep their menu places with a padlock and a locked page. "View documents" opens a sheet with every file and its status. Verification opens everything at once (the partner agreement isn't part of this flow for now). |
| 13 | **Registration: only "How did you find us?" and the referral code are optional** (26 Oct 2026). Required fields carry a red asterisk, explained once at the top. The "business already on GSP" check is out of the prototype. The GSP contact card shows only inside the portal, not on the documents screens. |
| 14 | **Documents GSP can't verify are replaced in the portal** (26 Oct 2026). GSP sends back one or more documents with a note each (wrong document, or can't be read). Home and the sidebar turn amber ("Needs you"), the documents sheet takes the new files, and "Send to GSP again" (only when every returned document has a new file) starts verification again. Verified documents stay as they are. |
| 15 | **Find courses follows the brief's five required fields** (26 Oct 2026): destination, student's country, state, level and area, with a plain-language, typo-tolerant box that fills them, and the student's country and state starting as the agency's. Hidden-by-territory courses are counted with the reason. Filters, sort and the card follow the PM prototype; a Student view hides earnings. Eligibility per student, compare and the shortlist PDF come next. |
| 16 | **A course page tells the agency everything before they apply** (26 Oct 2026): the university's logo and website, the campus (address, setting, map, regional for visa purposes), other campuses, CRICOS, placement, recognition, careers, similar courses, the scholarship and how to get it, costs beyond tuition, and the documents to collect. Logos sit on white in both themes; cards use the emblem. |
| 17 | **Students** (26 Oct 2026): a short add form (PM prototype fields plus where the student lives and the counsellor; since 27 Oct a centred dialog, with the current country, the counsellor fixed as whoever adds the student, and no consent tick), passport autofill to check, duplicates named with their owner, another agency's passport sent to GSP for the student to confirm, and a list with contact, counsellor, profile readiness and applications. The full student record comes next. |
| 18 | **Every student has a record, filled in over time** (26 Oct 2026). Adding a student asks for the basics: names, nationality, current country, email, phone, passport number, highest education. The record has Personal details, Education (the highest level required, levels below optional), Work experience, Tests (IELTS, TOEFL, PTE, Duolingo, SAT, ACT, GMAT, GRE), Background and Documents (passport and highest education required). The passport, marksheets and score reports are read into the profile. |
| 19 | **Counsellor as a name with a pencil** (26 Oct 2026), on the student list and record; picking someone else still asks first. Student list columns have equal gaps. |
| 20 | **Applications** (26 Oct 2026): list columns Application, Student, Course (university below), Intake, Destination, Counsellor, Stage, Status; an empty state with Add application; one page per application with the 8 stages, what you need to do, documents, chat and activity; and Add an application with an eligibility check. **GSP Assist** (the AI, in teal) runs through all of it: the day's brief, eligibility with reasons and close courses, reading offer letters and uploads before GSP, forecasts, what to watch, drafted student updates in English or Hindi, and a chat that answers first and hands over to a person. |
| 21 | **Application statuses follow the PM status table** (26 Oct 2026): each stage's statuses, who has each (You, GSP or University; the visa steps go to whoever lodges, you by default or GSP when asked) and the document that arrives there. GSP can ask for a document at any stage: it shows in the chat, in Documents and as Needs you, and can be answered from any of them. The brief shows only what needs you, as a carousel. Adding an application can add a new student on the spot, narrows courses by university, level and area, and takes the course's documents. **GSP Assist** wears the GSP logo's spectrum as a gradient, with an aurora background on its surfaces and liquid glass (a light dose) on what sits there; its mark animates. The application header has no status box: the owner is on the stage path, the status and its time on the current step. "What happens next" shows the current stage only; the chat has no "Talk to" button (answers hand over when needed); the list has no "new" tags. The application header has ⋯ (Student profile, Withdraw); You earn sits in the fact strip only. On 27 Oct the application page changed (see REVIEW.md): the student leads the header, the status sits in its corner with one owner tag, there's no fact strip and no Summary, and the chat drops the aurora and glass. |
| 22 | **Becoming a partner starts short; the rest happens in the portal** (26 Oct 2026). "Become a GSP partner" asks first and last name, registered business name, country, business email, and a password typed twice. A 6-digit code to the email creates the account and opens the portal on Home, where only Home is open. Home asks every business detail the old form asked (decision 5 still holds: none dropped, same rules), then the documents. Sending both to GSP opens Find courses and Profile; GSP's verification opens the rest. Updates decisions 5 and 6. |
| 23 | **Roles in the prototype** (27 Oct 2026). A Role button beside Prototype, for testing, picks who the portal is seen as: **RP Admin** (the agency portal as built so far) or **GSP Team**. GSP Team starts as a copy of the agency portal in `src/gsp/` (portal, Find courses, Students, Applications), sharing the data, components and stylesheets, so the two look the same today and GSP's screens can change without touching the agency's. GSP-only styles go in their own stylesheet. An RP Counsellor role can join the switcher for the counsellor view (see REVIEW.md, Everywhere). |
| 24 | **Connected roles in the prototype** (27 Oct 2026). Each role's portal keeps its own copy of the data, so connecting them is a testing tool, not product state: in the Role menu, **Connect RP Admin and GSP Team** is Off, One application (with its student) or All. A connected application is the same in both roles. A change in one shows in the other at once: in the same window when the role is switched, and live in **See both side by side** (the two roles in two panes of one window) or in another tab. The latest change wins; edits made in both roles at the same moment aren't merged. `src/proto/link.ts` holds the copies and passes them between windows; each portal calls `useLinkedData`. In the product, both portals read the same application, so none of this is needed. |
| 25 | **Sending a document back** (27 Oct 2026). GSP rejects a document with a reason, which the RP sees on its to-do list, in the chat and in Activity. While GSP is checking the documents, the application goes to **Waiting for re-upload** and the RP sends the new copy with Send to GSP, as the sample re-upload application already did. Later on, the rejection is a request, so the new copy comes straight back to GSP once uploaded. Accepting the last document of a check makes the application **Ready to submit**. |
| 26 | **Each application's documents** (28 Oct 2026). What an application needs depends on the university, the course and the student, so each one asks for its own set, decided when it's added and kept with it: the course's list (Find courses' Documents to collect), read for the student's education and English test (`docsFor` in `src/data/applications.ts`). Add an application collects all of it. **Anything needed later, at any stage, is a document request from GSP in the chat**: an offer's conditions, the deposit proof, the visa lodgement proof, and whatever else GSP needs. A request goes to GSP as soon as it's uploaded; the last one owed at the agency's own step moves the application on; one made for a step closes when the application leaves it. Both roles show the same set. Destination- or nationality-specific documents can join `docsFor` once GSP lists them. Supersedes the 27 Oct "for now, the 10th, 12th and UG marksheets". GSP verifies every document of a new application for it, those from the profile too, and the application's to-dos are only documents to upload (profile details are the profile's). |
| 27 | **The 8 stages and their statuses** (28 Oct 2026, Nesil's stage and status concept; supersedes the PM status table in decision 21, and in decision 25 the readying on the last accepted document). The statuses in each stage, and how each stage can close, are in README's table. **Only New to Pre-screening moves on its own**, when the agency sends the documents; GSP's team moves every other status, and closes applications, by hand with a reason. While GSP asks the agency for something, the application is the agency's; once everything asked for is in, it's GSP's at the same status. The university has the statuses where it's deciding. An offer's conditions are a form (questions and documents) GSP sends and the agency answers, in the chat or in a Conditions tab in Documents, knowingly against two REVIEW.md Decisions (one structured chat template; no tabs inside tabs). GSP Assist reads GSP's mail for the university's documents and offers to add them to Documents and tell the agency; it never moves the status. Every document can be previewed and downloaded in both roles (`src/components/DocView.tsx`). Student enrolled celebrates with a tick and party poppers, none under reduced motion. |
| 28 | **Who has it, and re-uploads** (28 Oct 2026, 3rd round; refines decision 27). In every stage, a document GSP asked for puts the application with the agency, and one the agency sent that GSP hasn't checked puts it with GSP; otherwise the status says who. **Document re-upload pending** is a status in every stage but New, the agency's: GSP rejecting a document puts the application there (it replaced Documents rejected; Additional documents submitted to university is gone). An offer's **conditions are questions only**. GSP Assist's **mail nudge follows the status**: the conditional and unconditional offer letters, the acceptance letter and the visa grant, each at its own status. GSP's **Change status** has no remarks and asks before closing. |
| 29 | **GSP · Institution, the Institution Team** (29 Oct 2026, replacing the Institution Partner copy made earlier that day). GSP Team members a GSP admin gives access to keep the institutions' records: universities, courses, institution partners (the agreements) and recruitment partners. Its own sign-in: GSP email, a password set up the first time with an emailed code, forgot password, no registering. Raj Shamani, GSP · Institution; "Institution Team" beside the logo. Pages: Home, Students, Applications, Course search, Recruitment partners, Institution partners, Universities, Courses. Nothing changed for it reaches GSP Team or RP Admin: it lives in `src/institution/`, with its own styles. **2nd round (29 Oct), from the PM prototype's IP team** (its features and flows, in this design): partners are Direct, Third-party or Aggregator with a relationship manager and a status set by hand; their dates come from their documents and their commission is read-only; each university sits under one partner and goes live on its own (campuses, scholarships, territory rules, submission and logins, changes verified by a second person); courses have a status, a source, tags and a change log, and the bots' risky updates are held for approval on Courses; Announcements is a ninth page; Home is the team's queue. Records open as pages with one row of tabs. **4th round (29 Oct, Nesil):** partners are Direct or Third-party, either with several universities; a partner is added with its status and nothing else is made for it; universities pick their partner (searchable) on their own page; no automation for universities (basics first, the rest by hand) and no four-weekly check; courses are added with their basics as drafts and published once their details are in. **6th round (29 Oct, Nesil):** a partner's status changes only after **Change**; Courses, Recruitment partners and Announcements follow the PM prototype's fields and flows with nothing added and no automation: no held updates, no course preview or change log, a course page with Basics, Intakes, Fees, Academic and English; recruitment partners to look at and export, with Overview, Documents and Activity; announcements with subcategories, recipients and a formatted description, and no log. **7th round (29 Oct, Nesil):** no Changes tab, so no second person verifies; instead every part of a record says who last changed it, and when, in small grey italics. No legal entity on partners; a university's partner changes from an edit icon by its name; display priority is a number; scholarships pick who they're for from dropdowns; territory countries are ticked in a pop-up with regions; a course's Basics has its university. Announcements publish on a date. **30 Oct (Nesil):** what's saved on a course's Intakes, Fees, Academic and English shows read-only until Edit; Fees asks for the full course fee (Course search works out the yearly tuition); campuses are added and edited in a pop-up with their state and Google Maps link; contacts can be edited; a scholarship's amount is a range, a percentage or an amount in a currency. GSP Team and this role pick the recruitment partner first when they add a student or an application. |
| 30 | **GSP · Admin** (30 Oct 2026): a fourth role for GSP's admins, a copy of GSP · Institution (`src/admin/`, its sign-in included) with the same design and **the same colours as every role** (RP Admin's; teal, then red and blue, were tried and dropped, 30 Oct). Signed in as Ishaan Verma. 30 Oct, later: its menu is Home and seven groups that open a small menu beside the sidebar; User modules and Institution are GSP · Institution's own pages (no copies), and the rest is its configuration from the PM's Super Admin › Settings (sales regions, permission roles, queues, BDM assignment, application routing, document configuration, logs), plus currency exchange, living costs and filters built from this prototype's figures. Later on 30 Oct: User roles gains Create roles (users with Nesil's eight roles, a sales region each, and Send login link) and Emails (email groups and who can view or send from each); sales regions are added, edited and deleted; queues are a name, a leader and members. |

### Liquid Glass in GSP

Apple's rule is that glass is the functional layer of controls and navigation floating above content, never the content itself, and used sparingly. For GSP, which runs on long lists and records all day, that means:

| Glass (control layer) | Solid (content layer) |
| --- | --- |
| Sign-in panel; the sidebar and the top bar; floating toolbars and filter bars over tables; small sheets, popovers, menus and toasts; the Ask GSP panel; the phone tab bar | Tables and queues, application and student records, stage paths, cards, document lists (including the Business documents sheet), money and charts, and the fields inside forms |

- **Regular glass** for anything with text; **clear glass** only over photos or video, with a dimming tint.
- **No glass on glass**, and no glass on a busy table without a scroll-edge fade.
- **Rounder controls everywhere:** capsule buttons and 12 px fields (already applied to registration).
- **Solid surfaces** whenever someone turns on "Reduce transparency" or "Increase contrast", or the browser lacks backdrop blur.
- **Blur once when nothing moves behind the glass;** live blur only for small or moving pieces.

### Still open

- Tier thresholds (item 4 below).
- Final vector redraw of the logo.
- Where the partner agreement fits, now that verification opens everything (item 3 below).

### Original questions

1. **Primary button colour.** upGrad red (`#EE2C3C`) is the design system's CTA colour, but red also means "rejected" and "overdue" in a status-heavy tool.
   - **(a) Near-black primary buttons, red for brand moments.** *I recommend this:* it keeps red meaningful and the screen calm.
   - **(b) Red primary buttons.** Errors then get a darker red with an icon and words.
2. **What counsellors see of money.**
   - **(a) Nothing,** like the legacy portal.
   - **(b) "You earn" on their own applications and in search (with the Student view switch), but no agency totals, rates table, statements or bank details.** *I recommend this.*
   - **(c) Everything,** as the prototype does now.
3. **Applications started before the agreement is signed.** The brief lets an activated agency apply but only earn after signing. Do those applications earn once the agency signs? This decides the copy on the agreement step and on applications.
4. **Tier thresholds.** The prototype's Earnings screen says 75% at 10 and 80% at 30 enrolments a year. Its Finance rules say 75% at 16–30 and 80% at 31+. I'll use **10 and 30** (the README) unless you say otherwise.
5. **Logo.** I suggest option 2 (dark lockup) in the product chrome, because it sits calmly beside the violet owner colour. Option 1 (colour) goes on Join and success moments, with the mark alone for favicon and collapsed sidebar.

**Defaults I'll use unless you say otherwise:**
- English UI, with layouts that allow longer strings.
- Sign-in by email plus one-time code.
- A light Updates feed instead of a full training hub in this release.
- The stack in section 6.

---

## 9. Sources

- `README.md`: goals, principles, AI table, key facts
- `references/docs/upGrad GSP The Brief, Explained Simply.pdf`: journeys 4.1 and 4.3, roles, steps 5–11 and 15–20
- `references/docs/What Our Agents Told Us … Explained Simply.pdf`: the 12 problems, competitor practice, the awareness gap
- `references/docs/Current Product Audits and Analysis.pdf`: sections 2–4 (prototype), 6–8 (agency audits), 9 (ApplyBoard), 10 (brand)
- `references/prototype/gsp-partner-portal.html`: walked as all 5 agency logins and the sign-up login, through every onboarding state; code read for `ST`, `NEXT`, `NEEDS`, `SU_DOCS`, `DOCRULES`, `BDM_RULE`, `ADM_SPOC`, team and branch rules, eligibility (`elig`), the apply flow, document sorting (`uploadReview`) and turnaround lines (`tatLine`)
- `references/audits/*_BOA_*`, `*_COU_*`, `*_HOA_*` and `references/competitors/ApplyBoard_*`: exact wording and counts
- Skills: `gsp-design` (product context, screen-to-reference map, reference analysis, AI patterns; G-02, G-11, G-13, G-16, G-29, G-35, G-47 viewed), `animation-library-by-nesil`, `upgrad-design-system`
