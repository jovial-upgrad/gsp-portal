# GSP reference analysis: the visual language across the 48 images

What the 48 GSP references have in common, broken down by layout, navigation, colour, type, components, charts, AI, documents, imagery and motion cues. Image numbers point to `gsp-reference-manifest.md` and `assets/gsp-references/gsp-NN-*.webp`.

## Contents
1. The overall direction
2. Layout and structure
3. Navigation
4. Colour
5. Typography and numbers
6. Components
7. Charts and data representation
8. AI features
9. Documents and files
10. Imagery, illustration and depth
11. What not to copy
12. Translating this into GSP

## 1. The overall direction

A calm, light, premium SaaS look: off-white or very light grey surfaces, white rounded cards, black or deep navy for primary actions, generous space, and exactly one bright accent per product (bright blue, lime, orange or yellow). Numbers are set as display type. AI appears as a distinct, softly coloured glass panel or card with suggested prompts. A minority of references (dark tools, bold colour blocking) are mood, not direction.

The three applyr screens (06, 14, 16) are the closest product precedent: a study-abroad platform with AI matches, course search, applications and documents. The Salesforce / Dynamics concepts (34, 35, 40, 45) are the closest workflow precedents: queues, records, stage paths, next actions, duplicates, list + detail.

## 2. Layout and structure

- **Dashboard pattern:** greeting + one-line summary top left, one oversized hero number or card, a grid of 3–4 supporting cards, then a list or table. Seen in 01, 04, 09, 13, 21, 22, 28, 29, 48.
- **Bento grid:** cards of different sizes; the biggest card signals the most important thing (18 action card, 30 hero score card, 22 rates analytics).
- **Record pattern:** title row with back arrow and big name → fact strip (IDs, owner, status, amount) → stage path / process bar → tabs (Summary, Documents, Activity…) → side column (score, chat, team). Seen in 33, 34, 35, 38.
- **List + detail split:** list on the left with the selected row inverted (black or dark), detail card on the right (40). Dynamics 35 uses list (My Work) + record side by side.
- **Process as columns:** steps drawn as connected columns with owner avatars and done marks (23).
- **Overlay / slide-over:** detail opened as a frosted panel over the dashboard (17), AI assistant floating over content (29, 42).
- **Browse-first empty state:** search page shows trending, categories and top items before any query (14).
- **Card anatomy:** 16–24 px radius, white on a tinted page, title top-left in medium weight, a small round ↗ or kebab top-right, content, one action bottom-right. Shadows are soft or absent; separation comes from the tint difference.
- **Spacing:** generous outer margins, 16–24 px gaps between cards, dense content inside tables only.

## 3. Navigation

- **Left sidebar with grouped labels** (applyr 06/14/16 navy; healthy 09 white; Dynamics 35 grey): small uppercase or grey section labels (Overview, Discover, Applications, Documents & Visa, Communication, Others), icon + label items, active item as a filled pill (glowing blue on navy in applyr, white on grey in 09, lime in 35). User profile at the bottom.
- **Centred pill navigation** at the top with one filled pill for the current page (01, 22, 25, 28, 29, 32, 44). Often paired with a thin vertical **icon rail** on the left for tools (01, 23, 32).
- **Tabs inside a page:** underline tabs (48), pill tabs with count badges (01: "Your Credits 12"), segmented controls (40: All / Draft 3 / Unpaid 5; 16: All / Submitted / Under Review / Received Offer / Draft).
- **Top-right cluster:** search, bell with dot or count, settings, avatar; on CRM screens a row of round icon actions (27, 45).
- **Breadcrumbs** and big page titles with a count bubble ("Leads Listing 12", 27).
- **Quick-create chips** under the title ("+ Sales Quote", "+ Sales Order", 48).

## 4. Colour

- **Base:** off-white (#F4F5F7 to #EEF0F3), white cards, near-black text (#111–#1A1A1A), grey secondary text (#8A8F98-ish).
- **Primary action:** black pill buttons dominate (04, 22, 29, 32, 35, 45, 47). applyr uses bright blue (#1A8CFF-ish) buttons with a navy shell.
- **One accent per product:** bright blue (applyr, Carevia 21), lime / acid yellow-green (17, 25, 35, 40, 42), orange-red (28, 29), yellow (04, 46, 47), periwinkle (09, 20).
- **Status colours are universal:** green = done / approved / eligible, amber or yellow = pending / under review / warning, red = blocked / missed / overdue, blue = informational / submitted, grey = draft / neutral. Pills often carry a small dot (16) or icon (09: ✓ Taken, ⊘ Missed).
- **Gradients are reserved** for insight and AI moments: pastel peach-to-lavender or yellow-to-lavender insight cards (18, 22, 48), rainbow-blur glass for AI (29, 42), pink-to-blue AI banner (06).
- **Hatching and stripes** mean "pending", "projected" or "empty": hatched bars (09, 37, 44, 48), striped progress (21, 33).
- **Pastel tints** for KPI tiles (09: pink, lavender, blue) and person cards (34: lime, mint, lavender).

## 5. Typography and numbers

- **Typeface:** geometric or neo-grotesque sans throughout (Inter / Manrope / Urbanist / Satoshi-like). Some concepts use a light geometric for numbers (Urbanist / Outfit-like).
- **Hierarchy:** big page title (28–40 px, regular or medium), card titles 16–18 px medium, body 13–14 px, labels 11–12 px grey.
- **Numbers as display type:** the largest text on any screen is a number — 730, 85%, 35,7%, $12,340, 6.91 — set light or regular at 48–96 px. Decimals or units are often greyed or smaller ("6.**91**", "24/38", "12 days").
- **Two-tone sentences:** greeting in black + continuation in grey (01), or mixed weights in one sentence ("Welcome **Marty**, here's **how things stand today!**", 13). Insight sentences bold the key phrase (05, 29).
- **Labels above values** in small grey (When / Team / Reminder in 04; Date of service / Claim ID in 37).

## 6. Components

| Component | What it looks like | Seen in |
| --- | --- | --- |
| Greeting header | Name + one-line summary of today, sometimes two-tone | 01, 04, 09, 13, 21, 30 |
| KPI / stat card | Small grey label, huge number, delta chip, optional sparkline or mini bars | 22, 25, 32, 40, 48 |
| Counter tile | Number + label + delta badge (+2 / -1) + sparkline, grouped by activity | 48 |
| Insight / action card | Gradient card with one sentence naming the issue and the people involved | 18, 22, 29, 48, 05 |
| Status pill | Rounded chip with dot or icon, semantic colour | 09, 16, 18, 22, 40 |
| Count badge | Small number bubble on tabs, titles, fields | 01, 27, 40, 45 |
| Stage path | Horizontal track with nodes / checks, current step highlighted | 33, 34, 35, 13 |
| Up Next / sequence | Ordered next steps, the first highlighted with a primary action and "Mark complete" | 35 |
| Task card | Title, meta columns (When / Team / Reminder), priority chips, people, one action | 04 |
| Deadline card | Item, date, "2 days left" chip, single action ("Upload Now") | 16, 21 |
| Profile / setup progress | % with the exact missing items as a checklist, or a stepper | 16, 13 |
| Match card | Logo, title, rank / match / fees chips, "why this matches" ticks, compare + save, primary button | 06, 14, 44 |
| Score ring / gauge | Radial % with a word label (Strong Match, Fair, Grade A) and reasons | 19, 28, 34, 35, 44 |
| Person / work-queue card | Avatar, name, task, type chip, date, score badge; pastel when active | 34, 35 |
| Record header | Back, big name, chips, fact strip (owner, source, status), toolbar actions | 33, 35, 38, 27 |
| Duplicate panel | Candidate records with match %, keep / reject, one "Smart Merge" | 45 |
| List + detail | Selected row inverted, detail card with totals and action | 40 |
| Table | Checkbox, name + secondary text, progress ring, dates, status pill, kebab; search + period filter | 09 |
| Team list | Avatar, name, role / email, contact icon, "+ Add" | 09, 21 |
| Timeline / activity | Dots on a line, title, source, link (View / Read / Details) | 21, 35 |
| Chat column | Persistent right column, voice notes, images, reactions, online count | 38, 37 |
| AI assistant panel | Glass card, suggested prompt chips, dark input with sparkle button, mic | 29, 42, 31, 12, 04 |
| AI progress toast | "Preparing the result 63%" | 36 |
| Folder card | Folder with documents peeking, name + file count, chevron | 05, 07, 10, 11 |
| Upload input | "Add the first document" with Auto mode, attach and send | 02, 08 |
| Success sheet | Check circle, title, one line, thumbnails of what was done, Confirm | 47 |
| Quick-create chips | "+ Item" chips under the page title | 48 |
| Floating toolbar | Bottom-centre pill of icon tools | 18, 22 |
| Filter bar | "Active filters 2", selects, date pickers, search | 40, 09, 21 |
| Avatar stack | Overlapping avatars + "+9" | 04, 18, 29, 40 |

## 7. Charts and data representation

- **Single stacked bar** for a pipeline split with labelled segments (16) — the most legible pipeline chart in the set.
- **Sankey / flow** between stages for drop-off (18); use for leadership, not daily screens.
- **Bars with a highlighted value** and a dashed limit line (09); others pale or hatched.
- **Line charts** with labelled points and a soft glow (22, 28); multi-series with legend dots (29).
- **Dense thin-bar fields** as texture behind rates (32) or cooperation history (27).
- **Gauges and rings** for scores and % complete (19, 28, 34, 35, 44); always with a word label.
- **Banded scale with a marker** (01: red / amber / green bands with a pointer) — good for tiers.
- **Month grid** of paid / missed / upcoming (17).
- **Before / after bars** inside an insight (29).
- **Capsule bars** with striped fills for progress (21).
- **Dot-matrix / halftone** numbers and charts (05, 19, 20, 26) as an occasional editorial touch.

## 8. AI features

- AI is shown as a **distinct surface**: glass panel with rainbow or pastel blur (29, 42), yellow assistant card (12), purple nudge strip (06), lavender-to-amber side panel (31).
- **Suggested prompts** are always present, never a blank box: chips with "+" (29), quick-request rows with ▶ (04), suggestion chips (12).
- **Input:** dark rounded input, "Ask anything or search…", sparkle button in the accent colour, mic, help (29).
- **AI on a task:** "✦ Ask AI to start" on a task card (04); AI analysis prompt on a record with model chips (43).
- **Working state:** waveform for listening (04, 36), "Preparing the result 63%" (36), "Voice dialing…" (03).
- **Scores with reasons:** AI lead score 92 with "Top positives" (34), Lead Score 90 Grade A with bullet reasons (35), "Why this matches you" ticks (06).
- **Nudges:** "You're 78% optimized. Adding your IELTS score could increase your match accuracy" (06); "Complete your profile to improve AI match accuracy" (16).

## 9. Documents and files

- Documents are **objects**: folders with papers peeking out and a file count (05, 07, 10), document thumbnails in chat (37) and on records (38), scanned sheets flowing into a folder (08).
- **Upload** starts from a friendly input ("Add the first document", Auto mode) rather than a form (02, 08).
- A folder can carry **process progress** ("Legal Review", 11).
- **Success** is a clear sheet with thumbnails and one Confirm (47).

## 10. Imagery, illustration and depth

- Presentation is almost always a **device mockup** (tilted monitor, tablet, phone in hand) on a soft grey or colour backdrop; the UI itself is flat.
- Inside the UI: **people photos** as avatars and large portraits on person records (27, 35, 45); **real photos** for places (12, 14 universities, 15, 36); **isometric renders** for property (22, 32); **line drawings** for objects (26).
- **Depth** through tint difference, soft blur and glass, not heavy drop shadows. Background blurs (warm or pastel) behind frosted cards (01, 17, 29).

## 11. What not to copy

- **Low contrast:** light grey type on off-white, thin weights for numbers, translucent text over blur — often below WCAG 4.5:1. GSP users read dense queues all day.
- **Decorative charts** that don't answer a question (dense bar fields, halftone textures, 3D blobs).
- **Glass everywhere:** keep it for overlays and the AI panel only.
- **One-item-per-card emptiness:** many concepts show 3–5 rows; GSP lists hold hundreds. Design real densities.
- **Device-mockup framing** is presentation, not product.
- **Generic AI look** (indigo-violet gradient + bare sparkle): see `ai-feature-patterns.md`; label AI and give it a colour distinct from the brand.

## 12. Translating this into GSP

- **Owner colours are a GSP rule:** amber = with the agency ("Needs you"), violet = with GSP, blue = with the university. Map the references' status palette onto this: green for done, red for blocked, grey for draft, and the three owner colours for "who has it".
- **Greeting + needs-you headline** (01, 13, 16) → RP Home: "Good afternoon, Ananya. 4 applications need you."
- **Action-required card** (18) → "Missing documents for 2 applications" on Home.
- **Stage path + Up Next** (33, 35) → the 8-stage tracker plus "Needs you: 1 thing to do" on the application page.
- **Match card + why** (06, 44) → course card with the eligibility verdict and its reason; never a fake precise %.
- **Profile completion with missing items** (16) → student readiness.
- **Deadline card** (16, 21) → intake deadlines and document due dates.
- **Duplicates + Smart Merge** (45) → duplicate student: show the owner, offer merge or request access.
- **List + detail** (40) → Admissions queues, Finance exceptions, payouts.
- **Folder cards + Auto upload + success sheet** (02, 07, 47) → documents.
- **Banded scale** (01) and **three-way money split** (13) → Earnings: tiers and Expected / Confirmed / Paid.
- **AI panel with suggested prompts** (29) → Ask GSP; **AI progress** (36) → agreement reading, document checks.
