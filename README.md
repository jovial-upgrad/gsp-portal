# upGrad GSP 3.0 — Design project

This folder holds everything needed to understand upGrad GSP (Global Study Partners) and to design GSP 3.0: the business, the existing product, what agencies told us, a competitor benchmark, design references, brand assets and two design skills.

**Owner:** Nesil Noble, lead product designer and product owner, upGrad GSP
**Go-live for GSP 3.0:** 15 December 2026, for every new application
**Last updated:** 25 October 2026

---

## 1. The goal

Revamp the entire UX and UI of GSP so it is **simpler to use and understand**, **removes manual work**, and **uses AI wherever it genuinely helps**.

GSP is a B2B platform. Local agencies (recruitment partners, "RPs") in India, Vietnam, Bangladesh, Nepal and other countries use it to find courses abroad, apply for students and track applications to enrolment. GSP does the admissions work with universities and earns a commission when a student enrols, passing 70–85% of it to the agency. About 50,000 applications a year are handled by a small regional Admissions team, so **the system should do the routine work and people should handle only the exceptions.**

### What success looks like

- **Every agency screen answers three questions at a glance:** Where is it, and who has it? What do I need to do? What will I earn?
- **Far less effort to start an application.** Today it takes about 80 interactions and 27 required fields across 4 steps and 6 pop-ups. ApplyBoard does it in about 25 interactions and 8 required fields. Aim for that or better.
- **No chasing.** The agency never has to phone or email to find out where an application is; GSP staff never retype what a document, email or agreement already says.
- **AI answers first.** The brief's target: 9 in 10 agency questions answered by the assistant, and a human reply within 2 working hours for the rest.
- **Nothing hidden.** Who acts next, what's missing and what the agency earns are always visible.

### Design and experience principles

1. **Reduce manual effort everywhere.** Prefill what the system knows, read data from documents, ask only what's needed now, defer the rest, let the student fill their own profile, and never make anyone pick something that has one option.
2. **Bring AI into the work, not beside it.** AI reads, checks, drafts, matches, places and suggests; people confirm, decide and handle exceptions. See section 6.
3. **People act; the system moves the status.** Upload, approve, send — and the status updates by itself. No tickets or tasks to create.
4. **Show who has it, in colour and words:** amber = the agency, violet = GSP, blue = the university.
5. **Every screen says what to do now.** Summary and next action first; detail one click away.
6. **The frame never changes with the state.** Tabs and sections stay in place; empty ones say so plainly.
7. **Minimal for agencies.** No internal statuses, staff checks or jargon ("entry requirements", never "assessment criteria").
8. **Warn, don't block.** Only hard rules stop an action, and every warning explains itself.
9. **Every automatic step is visible** in the activity log, with who or what did it.
10. **Chat is a first-class surface,** attached to the application it's about.

---

## 2. What's in this folder

### Docs (read these first)

| File | What it is | Read it to… |
| --- | --- | --- |
| `upGrad GSP The Brief, Explained Simply.pdf` | The GSP 3.0 Designer Brief retold in plain words: the business, users, product, the four journeys, the 8 application stages, design rules, features, problems, suggestions, glossary, and a 20-step end-to-end journey with the UI each step needs | understand the business and what GSP 3.0 must do |
| `What Our Agents Told Us … Explained Simply.pdf` | The field research: 28 agency sessions in 10 markets, the 12 problems ranked, quotes, problems by market, how agents choose a platform, today's portal with screenshots, a scorecard against Crizac, KC, Leverage and ApplyBoard, root causes, proposed flow, roadmap, and how it maps to the brief | understand the real pain and the evidence behind design decisions |
| `Current Product Audits and Analysis.pdf` | The master reference: every link, the PM's clickable prototype screen by screen, the four audits of today's portal, the ApplyBoard competitor audit, branding and logo options, and notes for Claude Code | understand the existing product, its problems and the benchmark |

**Inside `Current Product Audits and Analysis.pdf`:**

1. All references and links
2. The PM prototype: how to use it and its 14 logins
3. Prototype screens and features, role by role
4. What the prototype covers vs the brief, and what's missing
5. Today's portal: GSP staff (admin) audit
6. BOA – Recruitment Partner (branch admin) audit
7. COU – Counsellor audit
8. HOA – Head Office Admin audit
9. ApplyBoard – Competitor audit
10. Branding and logo options
11. Notes for Claude Code

### Raw audit files (exact on-screen wording)

| File | Login audited |
| --- | --- |
| `GSP_legacy_portal_UX_audit.md` | GSP staff, admin role |
| `GSP_legacy_portal_UX_audit_BOA_agency_view.md` | Agency branch admin (BOA) |
| `GSP_legacy_portal_UX_audit_COU_counsellor_view.md` | Agency counsellor (COU) |
| `GSP_legacy_portal_UX_audit_HOA_RP_head_view.md` | Agency head office admin (HOA) |
| `ApplyBoard_agent_portal_competitor_audit.md` | ApplyBoard partner portal (competitor, read-only) |

Use these when you need the exact label, error message, field list or click count. The PDFs summarise them.

### Brand assets

| File | What it is |
| --- | --- |
| `upGrad LOGO(2) 1.svg` | The upGrad logo (vector) |
| `upGrad GSP Global Study Partners Logo.png` | Logo option 1: colour lockup — speech-bubble mark, "upGrad" in red, "GSP" in a violet-to-cyan gradient, "GLOBAL STUDY PARTNERS" subline |
| `upGrad GSP Global Study Partners Logo (1).png` | Logo option 2: dark lockup — same mark, wordmark and subline in dark slate |
| `upGrad GSP Gradient Wordmark.png` | Logo option 3: stacked wordmark — "upGrad" red over gradient "GSP" |

Brand reference: the upGrad brand guidelines at https://wordpress-387988-6723665.cloudwaysapps.com/ — **a starting point, not a limit**; explore beyond it where the product needs to. The GSP logos are raster drafts: redraw the chosen one as SVG with exact colours, and keep the logo gradient away from the owner-colour status chips (violet is also "With GSP").

### Skills and design references

| File | What it is |
| --- | --- |
| `gsp-design.skill` | **The GSP Design skill.** 48 GSP design references + 72 visual-library references, GSP product rules, a screen-to-reference map, component and pattern analysis, AI feature patterns, 2026 trends, visual hierarchy and Laws of UX. Consult it before designing any GSP screen. |
| `animation-library-by-nesil (1).skill` | **Nesil's animation library.** Motion principles, 13 effect categories, named libraries (Motion, GSAP, Lenis, Rive, Lottie, Spline, R3F), a vetted tool audit, and a build and briefing playbook. Consult it for any motion. |
| `GSP Design REF..zip` | The 48 original design inspiration images (also bundled, renamed and described, inside `gsp-design.skill`) |

---

## 3. Setting up the skills in Claude Code

A `.skill` file is a zip of a skill folder. Claude Code loads project skills from `.claude/skills/<skill-name>/SKILL.md` inside the project, or personal skills from `~/.claude/skills/<skill-name>/SKILL.md` ([Claude Code skills docs](https://code.claude.com/docs/en/skills)).

From the project root:

```bash
mkdir -p .claude/skills
unzip "gsp-design.skill" -d .claude/skills/
unzip "animation-library-by-nesil (1).skill" -d .claude/skills/
ls .claude/skills/*/SKILL.md
# should list:
#   .claude/skills/gsp-design/SKILL.md
#   .claude/skills/animation-library-by-nesil/SKILL.md
```

Commit `.claude/skills/` so everyone working on the project gets the same skills. If the older `visual-library` skill is installed anywhere, remove it: `gsp-design` already contains all of it.

### How the skills should be used

**The rule for both skills: always consult them first, never treat them as a limit.** Pick up components, layouts, structures, styles, visuals and motion from them as the starting reference, then design beyond them wherever a better solution serves the user. Only the GSP product rules are fixed.

**`gsp-design`** — for any screen, component, flow, dashboard, layout or visual decision:

1. Read `references/gsp-product-context.md` (business, roles, journeys, stages, design rules, what today's portal gets wrong, what competitors do well, vocabulary, scale).
2. Find the screen in `references/screen-to-reference-map.md`: its job, the images to open first, the patterns to start from.
3. Open two or three of the named images with the image viewer (`assets/gsp-references/gsp-NN-*.webp`, `assets/visual-library-references/*.webp`). Look at them; don't rely on the descriptions alone.
4. Borrow components from the component table in `references/gsp-reference-analysis.md`; check the "What not to copy" list.
5. Before building, state the direction in a line or two: which references, what's being changed and why.
6. Design freely from there.

**`animation-library-by-nesil`** — for transitions, micro-interactions, loading, uploads, status changes, success moments or anything that should feel premium. For the GSP portal, motion should be fast and calm: micro-interactions first, a visible working state for AI and automatic steps, one considered moment for the peaks (submitted, offer, enrolled, payout), and respect for reduced-motion settings.

**Also use, where available:** `upgrad-design-system` for upGrad brand tokens and components; `frontend-design` for building UI; UX writing and accessibility skills before handoff.

---

## 4. Live links

The PDFs are snapshots. The live versions (editable, with comments) are on claude.ai and need a signed-in account with access:

| Doc | Link |
| --- | --- |
| upGrad GSP: The Brief, Explained Simply | https://claude.ai/artifact/NFw9wdVDciuh1ZphWwgrL1 |
| What Our Agents Told Us: Explained Simply | https://claude.ai/artifact/4SPv6Pvv8b6fdWitjmDukF |
| Current Product Audits and Analysis | https://claude.ai/artifact/2MngMecqHgKKJNbrkBWJpj |
| Today's GSP Portal: UX Audit, Explained Simply (admin audit; also in section 5 of the PDF above) | https://claude.ai/artifact/R8ixgdFimQBXFYhyD7vBsb |
| GSP 3.0: Designer Brief (original; owned by another organisation) | https://claude.ai/artifact/EZ94wHWNWRbNuW1haiEmNx |
| Field report, original (What Our Agents Told Us) | https://claude.ai/artifact/84CqNHuX5GvTvtsqJBvymF |
| PM prototype, GSP Partner Portal (copy) | https://claude.ai/artifact/N48JtRBf3QFjEbRKK7qZXh |
| Legacy portal (staging, needs a login) | https://stage-legacy-gsp-portal.upgrad.dev/ |

Claude Code can't open claude.ai links. Everything it needs is in the files in this folder.

---

## 5. Reading order

1. **This README.**
2. `upGrad GSP The Brief, Explained Simply.pdf` — the business, users, journeys and rules.
3. `What Our Agents Told Us … Explained Simply.pdf` — the problems, in agencies' words.
4. `Current Product Audits and Analysis.pdf` — today's portal (sections 5–8), the prototype (2–4), ApplyBoard (9), brand (10).
5. The `gsp-design` skill — before any design work.
6. The raw `.md` audits — when exact wording or counts matter.

**When sources disagree,** trust them in this order: the GSP 3.0 Designer Brief → design decisions recorded in our docs → the field report (problems and evidence) → the audits (how today's portal behaves) → the PM prototype (behaviour reference only; its visual style is a placeholder).

---

## 6. Reducing manual effort and bringing in AI

The redesign should remove manual work from every role. The table lists where AI and automation can do it. Items marked **brief** are already in the GSP 3.0 brief; the others are proposals to design and validate.

### For agencies (RP admins, branch admins, counsellors)

| Manual work today | AI or automation | Source |
| --- | --- | --- |
| 17 search inputs, exact match only | Plain-language search ("mba uk under 22k jan") fills destination, level and area; typo-tolerant | brief |
| Finding out eligibility after applying | One eligibility engine with a verdict and the reason; "what would make them eligible" (e.g. IELTS 6.5) and near-match alternatives | brief + proposal |
| 18 required fields to create a student | Passport autofill; transcripts and test reports fill education and scores; student self-fill link; only what eligibility needs up front | brief + ApplyBoard |
| Uploading files and picking categories | Drop many files; AI names and sorts each one; warns if a file looks wrong ("This looks like an IELTS result, not a passport") | brief |
| Re-uploading for every application | Documents kept once on the student and reused ("From the student record") | brief |
| Reading offer letters for conditions | AI turns a conditional offer's conditions into a checklist on the application | proposal |
| Phoning and emailing to chase status | Status updates by itself; Ask GSP answers from the application's data, cites it, and hands over to a person when needed | brief |
| Missing expiring documents | Expiry watch: passport or English test expiring before the course or visa date | proposal |
| Working out what to do next | "Needs you" list and a next-action banner on every application; daily WhatsApp digest | brief |
| Guessing commission | Earnings forecast by stage, tier progress, rates per university; no claims to raise | brief |
| Language barriers in chat | Chat translation (e.g. Vietnamese ↔ English) | proposal |

### For GSP teams

| Manual work today | AI or automation | Source |
| --- | --- | --- |
| Checking every document by hand | Automatic checks (passport code, English score lookup, name and date matching, tamper check); Admissions reviews only flags, with the evidence side by side | brief |
| Reading shared inboxes and re-routing university emails | Email engine places each email on its application, proposes the outcome (offer, rejection), and leaves only unclear ones with its top three guesses | brief |
| Typing university records from agreements | AI reads the signed agreement and drafts the records; people confirm only low-confidence fields | brief |
| Keeping course data current | Course bots refresh from StudyLink and university sites; only risky changes (fee jumps, new campuses, email-only changes) are held for the Data team | brief |
| Calculating commission and raising claims | Commission engine prices every line; rules drafted from variation letters, activated by a second person; weekly self-billed statements | brief |
| Central triage and manual assignment | Applications go straight to the region's queue, round robin, with one owner from start to finish | brief |
| Writing replies when the assistant hands over | Suggested replies drafted from the application for Admissions to edit and send | proposal |
| Spotting stuck agencies and late applications | At-risk alerts for applications likely to miss a deadline and agencies going quiet | brief + proposal |
| Verifying new agencies | Automatic checks against rejected agencies (registration number, email domain) | prototype |
| Finding duplicate students | Duplicate detection that shows the existing record and owner, with merge or request access | proposal |

### AI design guardrails

From `gsp-design` (`references/ai-feature-patterns.md`) and the brief:

- **Copilot, not autopilot.** AI suggests and drafts; people confirm anything that matters. The agency assistant never changes data.
- **Label AI clearly** with text and a colour distinct from the brand primary; don't rely on a bare sparkle icon or the generic indigo-violet gradient.
- **Show the reasoning and the evidence** (the document, the email, the rule) and a confidence level; escalate low-confidence cases to a person.
- **Show a working state** for anything slower than about 400 ms ("Reading agreement…", "Checking 3 documents").
- **Always allow undo or correction,** and log every automatic step in the activity history.
- **Hand over to a person** for money, exceptions and complaints.

---

## 7. Key facts and numbers

- **Roles:** agency head office admin, branch admin, counsellor (Master Partner later); GSP BDM / recruitment manager, recruitment head, BAP, Admissions, Admissions head, IP team, Data team, Commissions & Finance, Super admin, Leadership.
- **Application stages (8):** New → Pre-Screening → Application → Offer → Verification → Acceptance → Visa → Enrolled. Each stage has one owner at a time.
- **Owner colours:** amber = agency, violet = GSP, blue = university.
- **Commission:** the agency gets 70% base, 75% at 10 enrolments a year, 80% at 30; paid weekly by self-billed statement after the census date.
- **Scale in today's staging data:** 84,092 students, 155,235 applications, 6,166 agencies, 1,013 institutions. Design lists, search and filters for this volume.
- **Agency navigation:** Home, Applications, Students, Find courses, Earnings, Profile, plus "Ask GSP" everywhere.
- **Top agency problems (field report, of 27 sessions):** unclear document requirements (14), course search and data quality (14), slow responses (12), talking off the portal (11), can't see if it reached the university (10), eligibility found after submitting (10).

---

## 8. Not in this folder yet

- **The PM prototype's file** (`gsp-partner-portal.html`). It was shared in the design chat as a download; add it under `references/prototype/`. It opens in any browser and its code defines roles (`ROLES`), statuses (`ST`), their order (`NEXT`) and agency actions (`NEEDS`).
- **The original GSP 3.0 Designer Brief.** Only the "Explained Simply" version is here. Export the original once it's shared with this account.
- **Audits of GSP's internal teams' own logins** (Admissions, BDM, Finance). Today's portal was only seen through a super-admin login on the GSP side.

## 9. Suggested repository layout

```text
.
├── README.md
├── .claude/skills/
│   ├── gsp-design/
│   └── animation-library-by-nesil/
├── references/
│   ├── docs/          # the three PDFs (and Markdown exports if preferred)
│   ├── audits/        # the four GSP_legacy_portal_UX_audit*.md files
│   ├── competitors/   # ApplyBoard_agent_portal_competitor_audit.md
│   ├── prototype/     # gsp-partner-portal.html
│   ├── brand/         # logos and the upGrad SVG
│   └── design-ref/    # GSP Design REF..zip (originals)
└── designs/           # new work goes here
```
