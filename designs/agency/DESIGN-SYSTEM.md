# GSP 3.0 design system: the specification for developers

This is the reference to build GSP 3.0 from. It covers, for every role and page of the prototype in `designs/agency/`:
- the foundations: type, colour, spacing, radius, sizes, elevation, motion and icons;
- the layout and grid;
- the page patterns;
- every shared component;
- the writing rules and accessibility.

Every value here is read from the code (5 Nov 2026). Where the code and this page disagree, **the code wins**; please report it so this page can be fixed. Section 12 lists the known gaps, each with its fix.

### How to use this page

- **Building a screen:** start from its role and page in section 8, follow the page pattern in section 4, then take each component's specs from section 5.
- **Looking up a value:** foundations are in section 2. Each colour table lists both light and dark values.
- **Each rule is written once.** Where a rule matters in more than one place, the other places point to it ("section 5.10").

### Keeping this page current

- **This file is the master copy.** The PDF (`docs/GSP-Design-System.pdf`) is made from it.
- **Change it in the same commit** whenever a token, a component or a design rule changes. That applies to designers, developers and Claude sessions alike.
- **Regenerate the PDF** after changing this file:
  1. once only: `pip install markdown` (Playwright's Chromium must also be installed, as for the browser tests);
  2. then, in `designs/agency`: `npm run build:design-pdf`.
- **Fixed gaps:** when a gap in section 12 is fixed, remove it and update the section it belongs to.
- **The Figma library** ([GSP Designs](https://www.figma.com/design/VvXKKKIZdxWwx9AuUEzBRL/GSP-Designs)) is built from the same code: the Color (Light and Dark) and Dimension variables, whose code syntax is the CSS variable; the text and effect styles; the 67 icons; the components with their variants; every role’s sidebar, notifications and announcements (Navigation); expandable pop-ups and confirmations (Overlays and Feedback); a Validation and Errors page (field states, messages, sign-in errors, banners, empty states); and an Inbox page (mail tags, the link or forward nudge). When a token, component, state or role changes here, change it there in the same task.

| Where | What |
| --- | --- |
| `src/styles/tokens.css` | Every design token, light and dark. **Use tokens, never raw values.** |
| `src/styles/base.css` | Reset, body type, focus ring, `.num`, `.vh`, the owner chip `.who` |
| `src/components/` | Shared components (section 5) |
| `src/shell/` | The app frame (`AppShell`) and the sign-in scene (`AuthScene`) |
| `README.md` | Every screen, state and control, page by page |
| `REVIEW.md` | Every agreed change, by page; open questions |
| `PLAN.md` | The numbered design decisions |

Open the prototype with `npm run build:artifact` and then open `dist-artifact/gsp-partner-portal.html`. Pick the role with **Role** at the bottom right. **Prototype** switches light and dark mode and the 390 px phone frame.

---

## Contents

1. [Principles](#1-principles)
2. [Foundations](#2-foundations): type, colour, spacing, radius, sizes, elevation, layers, motion, icons, glass
3. [Layout and grid](#3-layout-and-grid)
4. [Page anatomy](#4-page-anatomy)
5. [Components](#5-components)
6. [Patterns](#6-patterns): who has it, status, SLA, tiles, filters, tables, settings, confirmations, logs, mail threads
7. [Writing](#7-writing)
8. [Roles and pages](#8-roles-and-pages)
9. [Accessibility](#9-accessibility)
10. [Light and dark](#10-light-and-dark)
11. [Prototype-only: don't build](#11-prototype-only-dont-build)
12. [Known gaps to resolve](#12-known-gaps-to-resolve)

---

## 1. Principles

These come from the brief and the review meetings. Every screen follows them.

1. **Every screen says what to do now.** The summary and the next action come first; detail is one click away.
2. **Show who has it, in colour and words:**
   - amber is the agency (RP);
   - violet is GSP;
   - blue is the university.

   Colour never stands alone.
3. **The frame never changes with the state.** Tabs and sections stay in place; empty ones say so.
4. **People act, and the system moves the status.** There are no tickets to create.
5. **Warn, don't block.** Only hard rules stop an action, and every warning explains itself.
6. **Every automatic step is visible** in Logs, with who or what did it.
7. **Minimal for agencies.** No internal statuses or jargon.
8. **One component everywhere.** The same dropdown, pop-up, confirmation and table in every role (Decision 34).
9. **No tabs inside tabs** (a Decision). Record pages have **one** row of tabs.
10. **Every remove, delete, deactivate or unlink asks first.**

---

## 2. Foundations

### 2.1 Typeface

- **Family:** `--font-sans: "CircularXX TT", "Figtree", "Noto Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
  - **Production uses CircularXX TT**, which is licensed; add its `@font-face` files.
  - The prototype has no CircularXX files, so it shows **Figtree**, loaded from Google Fonts at weights 400, 500, 600 and 800, as a stand-in at the same sizes.
- **Tracking:** `--tracking: -0.01em` on the body and headings. Page titles tighten to `-0.022em`.
- **Weights:**
  - `--fw-book` 400: body text;
  - `--fw-medium` 500: labels, buttons, headings h1 to h4 by default;
  - `--fw-semi` 600: titles, emphasis, counts.

  Weight 800 is loaded but not used in the UI.
- **Numbers:** add class `.num` (`font-variant-numeric: tabular-nums`) to every number in tables, counts, dates and money, so the digits line up.
- **Body defaults** (`base.css`): `--t-body` on `--lh-body`, colour `--text-2`, antialiased, `text-rendering: optimizeLegibility`.
  - Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### 2.2 Type scale

| Token | Size / line height | px | Use |
| --- | --- | --- | --- |
| `--t-display` / `--lh-display` | 2rem / 2.5rem | 32 / 40 | Page title (h1). Drops to 1.625rem / 2rem (26 / 32) at a container width of 600 px or less |
| `--t-title` / `--lh-title` | 1.25rem / 1.75rem | 20 / 28 | Pop-up title, card title |
| `--t-subtitle` / `--lh-subtitle` | 1.0625rem / 1.5rem | 17 / 24 | Section and panel titles (h2), the one-line lead under the page title (line height 1.625rem), confirmation title |
| `--t-body` / `--lh-body` | 0.9375rem / 1.375rem | 15 / 22 | Body, buttons, nav items, switch and checkbox labels |
| `--t-input` / `--lh-input` | 1rem / 1.5rem | 16 / 24 | Text in inputs and dropdowns. **Keep it at 16 px so phones don't zoom.** |
| `--t-label` / `--lh-label` | 0.875rem / 1.25rem | 14 / 20 | Field labels, table cells, small buttons, chips, menus, facts |
| `--t-caption` / `--lh-caption` | 0.8125rem / 1.125rem | 13 / 18 | Hints, table headers, secondary lines in cells (`.cfg__sub`), notes |
| `--t-micro` / `--lh-micro` | 0.75rem / 1rem | 12 / 16 | Owner chips, document pills, group headers in lists (uppercase, `0.04em`) |

Other sizes in use:
- the record-page title is 1.625rem / 2.125rem (26 / 34), with `-0.015em` tracking, dropping to 1.375rem at 640 px or less;
- the numbers on tiles are 2rem / 2.25rem semibold with `-0.02em` tracking;
- the phone tab-bar labels are 0.6875rem / 0.875rem (11 / 14).

### 2.3 Colour: neutrals and brand

Each token has a light and a dark value; the app switches them by theme (section 10). Always use the token, never the hex code.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F5F6F8` | `#0B0F17` | Page background |
| `--surface` | `#FFFFFF` | `#121823` | Cards, pop-ups, inputs |
| `--surface-2` | `#F0F2F5` | `#171F2C` | Sunk areas: table headers, pop-up footers, hovered rows, chip counts |
| `--surface-3` | `#E8EBF0` | `#1E2836` | Disabled primary buttons, pressed states |
| `--line` | `#E4E7EC` | `#232D3C` | Card borders, row dividers |
| `--line-strong` | `#CDD2DA` | `#364256` | Secondary-button and chip borders, decorative edges |
| `--line-input` | `#8A93A2` | `#5F6B80` | **Form control borders** (3.1:1 on white, WCAG 1.4.11) |
| `--text` | `#0B0F19` | `#F1F4F8` | Headings, values, strong text |
| `--text-2` | `#344054` | `#C9D0DA` | Body text, labels |
| `--text-3` | `#5D6676` | `#9AA4B4` | Meta text, hints, table headers (5.9:1 on white) |
| `--text-3-glass` | `#485061` | `#B4BDCA` | Meta text on glass (keeps 4.5:1 over the darkest glass) |
| `--placeholder` | `#6A7383` | `#7F899A` | Input placeholders, empty dropdowns |
| `--primary` | `#0E2C4C` | `#DCE8F7` | **Main buttons**, checked boxes, the current page in the pager. Navy, from the GSP logo blue. **In dark mode it turns light blue, so primary buttons invert** |
| `--primary-hover` | `#173F68` | `#FFFFFF` | Primary hover |
| `--primary-press` | `#0A2038` | `#C2D5EE` | Primary pressed |
| `--on-primary` | `#FFFFFF` | `#0B1F38` | Text on primary |
| `--primary-soft` | `#E8EFF7` | `#16263C` | Avatars, removable chips, ticked rows, inline actions |
| `--link` | `#1A4F86` | `#8EC0F2` | Links, link buttons, the active nav icon |
| `--focus` | `#2B7AB3` | `#6CA8E0` | Focus ring and focused input border |
| `--brand-red` | `#EE2C3C` | `#FF4A5A` | upGrad red: **the logo only** (and brand phrases) |
| `--brand-red-text` | `#BE2330` | `#FF7A86` | Red text at small sizes, such as the required `*` |
| `--logo-red` | `#FF0031` | `#FF2D4F` | From the official logo file |
| `--gsp-1…4` | `#AC225E` `#5E2D77` `#2B7AB3` `#04A5CB` | `#E0508C` `#A274E0` `#4FA3E0` `#36C9E6` | The GSP logo gradient. **Logo only:** keep it away from the owner chips |
| `--switch-on` | `#0E2C4C` | `#4F8FD6` | A switch that's on |
| `--switch-off` | `#E3E7ED` | `#263042` | A switch that's off (with `--switch-off-line` `#8A93A2` / `#5F6B80`) |
| `--scrim` | `rgba(11,15,25,.48)` | `rgba(3,6,12,.66)` | Behind pop-ups |

### 2.4 Colour: who has it (owner colours)

The brief's rule: **amber is the agency, violet is GSP, blue is the university.** Always pair the colour with words ("With you", "With GSP", "With the university"). Each owner colour has four tokens.

| Owner | Theme | Text `--x` | Background `--x-bg` | Line `--x-line` | Dot `--x-dot` |
| --- | --- | --- | --- | --- | --- |
| Agency / RP (`you`) | Light | `#8F4E00` | `#FFF1DB` | `#F2C27E` | `#E08A00` |
| | Dark | `#F6B95C` | `rgba(224,138,0,.16)` | `rgba(246,185,92,.36)` | `#F2A23A` |
| GSP (`gsp`) | Light | `#5B33A6` | `#F1EBFC` | `#D5C4F5` | `#7C4DDB` |
| | Dark | `#C2A6F6` | `rgba(124,77,219,.2)` | `rgba(194,166,246,.34)` | `#A27CEE` |
| University (`uni`) | Light | `#1A55AE` | `#E5EFFC` | `#BCD3F5` | `#2F74E0` |
| | Dark | `#8DBBF7` | `rgba(47,116,224,.2)` | `rgba(141,187,247,.34)` | `#5A97EE` |

How the four tokens are used:
- text sits on the `-bg`;
- the dot uses `-dot`;
- borders and selected tiles use `-line`.

Do not use amber or violet for anything else, such as warnings, decoration or AI. That's why "Due soon" pills are grey with a red dot.

### 2.5 Colour: status

| Status | Theme | Text | Background | Line | Dot |
| --- | --- | --- | --- | --- | --- |
| Done, OK, verified, on track (`ok`) | Light | `#17703F` | `#E3F4EA` | `#A9DABD` | `#2E9E5B` |
| | Dark | `#74D7A0` | `rgba(46,158,91,.18)` | `rgba(116,215,160,.34)` | `#4CC183` |
| Problem, breached, error, danger (`bad`) | Light | `#B4231B` | `#FDECEA` | `#F4B8B2` | `#E5483B` |
| | Dark | `#FF968C` | `rgba(229,72,59,.18)` | `rgba(255,150,140,.36)` | `#F26B5F` |
| Neutral, ended, paused, completed (`neutral`) | Light | `#5D6676` | `#EEF0F3` | | `--line-strong` |
| | Dark | `#A9B2C1` | `rgba(154,164,180,.14)` | | `--line-strong` |

Red is for errors, breaches and destructive actions. Green is for done, and for the "Mark as completed" action.

### 2.6 Colour: AI (GSP Assist)

AI has its own look, so it never reads as the brand navy or an owner colour. Always label it with text.

- **Gradient:** `--ai-grad` is `linear-gradient(120deg, s1, s2 38%, s3 72%, s4)` (magenta, plum, blue, cyan).

  | Token | Light | Dark |
  | --- | --- | --- |
  | `--ai-s1` … `--ai-s4` (gradient stops) | `#C2246B` `#7A2E91` `#2F6FD0` `#0AA6C9` | `#F05A9B` `#B07CF0` `#5AA2F5` `#3FD3EC` |
  | `--ai` (small text) | `#7E2470` | `#F0A6DB` |
  | `--ai-bg` | `#F8EEF6` | `rgba(194,36,107,.16)` |
  | `--ai-line` | `#E6C6E0` | `rgba(240,166,219,.3)` |

- **Gradient text:** `--ai-grad-text`.
- **Surfaces:** a pastel aurora (`--aur-*`, `--ai-base`) under light liquid glass (`--ai-glass*`).
- **The chat frame:** `--chat-bg`, `--chat-bezel`, `--chat-rim`, `--chat-glass`.
- **Working state:** show one for anything slower than about 400 ms ("Reading agreement…").

### 2.7 Spacing

The upGrad uG scale. Use only these values: `--sp-2` 2, `--sp-4` 4, `--sp-6` 6, `--sp-8` 8, `--sp-10` 10, `--sp-12` 12, `--sp-16` 16, `--sp-20` 20, `--sp-24` 24, `--sp-32` 32, `--sp-40` 40, `--sp-48` 48, `--sp-64` 64.

`--sp-14` is **not** defined. The code writes `var(--sp-14, 14px)` for table cells and chips. Either add the token or keep the fallback.

| Where | Spacing |
| --- | --- |
| Label to control, inside a field | 6 |
| Between fields in a form | 16 vertical, 16 to 20 horizontal |
| Inside a card or section | 20 to 24 (16 on phones) |
| Between cards and sections on a page | 16 to 24 (section 3.5) |
| Page title to its lead | 6 |
| Buttons in a row | 8 to 12 |

### 2.8 Radius

| Token | Value | Use |
| --- | --- | --- |
| `--r-ctl` | 12 px | Inputs, dropdown fields |
| `--r-sm` | 12 px | Small cards, tiles, dropdown lists, multi-select panels |
| `--r-card` | 16 px | Cards, menus |
| `--r-lg` | 24 px | Pop-ups, confirmations, the sidebar, flyouts |
| `--r-pill` | 999 px | Buttons, chips, pills, tabs, nav items, the tab bar |

Smaller fixed radii also appear:
- 10 px on menu items, pager buttons and toast icons;
- 6 px on dropdown options and inline actions;
- 5 px on checkboxes;
- 14 px on toasts and the record-head mark;
- 28 px on the top corners of bottom sheets;
- 32 px on the sign-in panel.

### 2.9 Sizes

| Token | Value | Use |
| --- | --- | --- |
| `--h-input` | 48 px | Text inputs, dropdowns, multi-selects (44 px inside filter bars and tables) |
| `--h-btn` | 44 px | Buttons |
| `--h-btn-sm` | 36 px | Small buttons |
| `--sidebar-w` | 272 px | The sidebar |

Other sizes:
- icon buttons are 32 px, with a 44 px tap target;
- nav items are 42 px;
- chips are 36 px (40 in view switchers, 44 in toolbars);
- tabs are 40 px;
- pager buttons are at least 36 px;
- checkboxes are 20 px;
- the switch is 38 × 22;
- avatars are 36 px;
- the phone tab bar is 56 px.

### 2.10 Elevation

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--shadow-xs` | `0 1px 2px rgba(9,30,66,.06), 0 2px 6px rgba(9,30,66,.04)` | `0 1px 2px rgba(0,0,0,.4)` | Cards, tiles, the theme-toggle thumb |
| `--shadow-card` | `0 2px 4px rgba(9,30,66,.04), 0 12px 32px rgba(9,30,66,.06)` | `0 1px 2px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.28)` | Selected tiles, raised cards |
| `--shadow-pop` | `0 18px 48px rgba(9,30,66,.16), 0 2px 8px rgba(9,30,66,.06)` | `0 18px 48px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)` | Pop-ups, menus, dropdown lists, confirmations |
| `--input-glow` | `0 0 0 4px rgba(43,122,179,.14)` | `0 0 0 4px rgba(108,168,224,.2)` | Focused input (red version `0 0 0 4px var(--bad-bg)` when invalid) |

Light shadows are navy-tinted and soft; dark ones are black and stronger. The primary button's hover adds `0 8px 24px rgba(14,44,76,.18)`.

### 2.11 Layers (z-index)

| Layer | z-index |
| --- | --- |
| Shell content | 0 to 8 |
| Phone top bar, tab bar | 20 |
| Inline combobox lists (country, city, search pick) | 30 |
| **The overlay layer `#layer`** (pop-ups, dropdown lists, menus, flyouts) | 60 |
| Confirmation (inside `#layer`, above pop-ups) | 2 within the layer |
| Toast | 70 |
| Multi-select panel | 80 |
| Skip link | 100 |
| Prototype controls (don't build) | 200 |

**Pop-ups, dropdown lists, menus and the multi-select panel render into `#layer`,** a `position: fixed; inset: 0` element at the end of the app. That way they're never clipped by a card or a scrolling table.

### 2.12 Motion

From the animation library: fast and calm, transform and opacity only, built with `motion/react`.

- **Tokens:**
  - durations: `--dur-1` 120 ms, `--dur-2` 200 ms, `--dur-3` 320 ms;
  - easing: `--ease-out` `cubic-bezier(.2,.8,.2,1)` is the default; also `--ease-in` `(.4,0,1,1)` and `--ease-in-out` `(.65,0,.35,1)`.
- **Values used in code:**

  | What moves | Duration | How |
  | --- | --- | --- |
  | Page (route) change | 0.28 s | scale 0.995 |
  | Section change | 0.22 s | y 8 → exit y −4 |
  | Pop-up | 0.32 s | side panel from x 40; centred from y 12 at scale 0.97; modal from y 18; phone from y 48 |
  | Pop-up scrim | 0.24 s | fade |
  | Confirmation | 0.2 s | scrim 0.18 s |
  | Menus, flyouts | 0.18 s | exit 0.12 s |
  | Toast | 0.22 s | from x −12 at scale 0.98 |
  | Dropdown list | `--dur-2` | from y −4 at scale 0.99 |
  | Nav and tab lens | spring | stiffness 520, damping 40 to 42 |
  | Switch knob | 420 ms | spring `cubic-bezier(.3,1.5,.5,1)` |

- **Reduced motion is respected everywhere:**
  - `useReducedMotion()` switches to opacity only, or duration 0;
  - `base.css` cuts every CSS animation and transition to 1 ms under `prefers-reduced-motion`.
- **Peaks** (submitted, offer, enrolled, payout) get one considered moment (`Celebrate`). Everything else stays quiet.

### 2.13 Icons

- One set, in `components/Icon.tsx` (`<Icon name size />`):
  - 24 px viewBox, 1.6 stroke, round caps, `currentColor`;
  - 20 px by default (14 to 18 in small buttons, 22 in the tab bar);
  - always `aria-hidden`; the button or link carries the words.
- **The 67 names:** check, checkCircle, lock, chevronDown, chevronRight, sort, arrowRight, arrowLeft, mail, phone, chat, info, alert, close, search, file, building, user, clock, shield, edit, refresh, sun, moon, monitor, mobile, sliders, upload, globe, wallet, people, home, doc, share, copy, cap, eye, eyeOff, key, partner, logout, capslock, plus, folder, download, minus, trash, image, grip, external, expand, collapse, more, attach, pin, calendar, award, star, briefcase, bell, tag, inbox, archive, reply, forward, send, megaphone.
- **Common uses:**
  - plus: Add or Create;
  - edit: Edit;
  - close: remove or close;
  - more: the ⋯ menu;
  - check: My work, Save Changes;
  - download: CSV;
  - bell: notifications;
  - megaphone: announcements.

### 2.14 Liquid Glass

Glass is used in the **frame only**:
- sign-in and registration;
- the sidebar;
- the phone top bar and tab bar;
- the bell and megaphone circles;
- the account menu;
- GSP · Admin's flyout.

Content areas stay solid white cards.

- **Spec** (`components/glass.css`):
  - tint `rgba(255,255,255,.78)` with `blur(28px) saturate(1.6) brightness(1.1)` (the sidebar uses `.5` with `blur(24px) saturate(1.8)`);
  - a 1.5 px gradient rim (`GlassRim`);
  - dark tint `rgba(18,24,36,.66)`.
  - `.glass--clear` is for use over photos only.
- **Fallback:** a solid `--surface` with a `--line-strong` ring under `prefers-reduced-transparency`, `prefers-contrast: more`, or when a browser has no `backdrop-filter`.
- Glass overrides `--text-3` with `--text-3-glass` to keep contrast.

---

## 3. Layout and grid

### 3.1 The frame (`AppShell`)

**Wide** (container wider than 900 px):
- **Grid:** `calc(var(--sidebar-w) + var(--sp-12)) minmax(0, 1fr)`, so a 284 px column plus the page.
- **Sidebar:**
  - a glass panel, 272 px wide;
  - sticky at top 12, height `calc(100dvh - 24px)`, margin `12px 0 12px 12px`;
  - padding `24px 16px 16px`, radius 24.
- **Inside the sidebar, top to bottom:**
  1. the brand lockup (34 px high), with the role's label beside the logo;
  2. a divider;
  3. the nav, with 2 px between items. Each item is 42 px high, with 12 px padding, a pill shape, `--t-body` text and a 20 px icon. The current page sits on a sliding glass "lens", with its icon in `--link`;
  4. the account menu and the theme toggle at the foot.
- **Top strip:** the bell and megaphone in their own 44 px glass circles at the top right.
  - Padding `16px 40px 8px 32px`, so the strip is 68 px high.
  - **The page scrolls under the strip, not behind it,** fading at its top edge (`mask-image: linear-gradient(to bottom, transparent, #000 16px)`).
- **Page padding** (`.shell__scroll`): top 16, bottom 64, left 32, right 40, with safe-area insets.

**Narrow** (container 900 px or less; phones and tablets):
- The sidebar and strip are hidden.
- **Top bar:** sticky, glass, about 60 px high, with a 28 px lockup and the bell and megaphone at 36 px.
- **Page padding:** top 20, bottom 24, sides 16.
- **Tab bar:** floating glass at the bottom, 12 px in from the edges, pill-shaped.
  - It always holds **five** tabs, each 56 px high, with a 22 px icon and an 11 px label.
  - Each role's five are listed in section 8.

**Responsive rules use container queries** (`@container app (max-width: …)`) on `.app`, so the layout follows the app's width rather than the window's. **Keep `.app { container: app / inline-size }`.** In the prototype it lives in `proto/stage.css`; move it into the product CSS.

### 3.2 Page widths

| Max width | Pages |
| --- | --- |
| 760 px | RP Admin's simple sections (`.page`) |
| 1160 px | Home, Students, Find courses, the student record (`.home`, `.stu`, `.find`, `.record`) |
| 1240 px | Applications, the application page, and every GSP · Institution, Admin and RP Ops page (`.apps`, `.aapp`, `.ipage`) |
| None | RP Admin's Profile (`.page--full`), Inbox (`.mbx`) |

### 3.3 Breakpoints

**Container breakpoints** (the main ones, measured on the app's width):

| ≤ width | What changes |
| --- | --- |
| 1420 | Students and Applications tables tighten; the application side column narrows to 290 px |
| 1360 | Course facts go to 3 columns |
| 1280 | The application row's destination becomes a flag only |
| 1180 | Application tools go to 3 columns; the application body and header stack |
| 1100 | Home grid → 1 column; Find courses filters move into a bottom sheet; the student record goes to 1 column (its side nav becomes horizontal); config grids → 1 column |
| **900** | **Phone frame: top bar and tab bar; pop-ups become bottom sheets; the toast moves** |
| 760 | Students table → cards; owner tiles → 2 columns; filters → 2 columns; the record header reflows |
| 700 | Simple tables become blocks; 2-column forms in tables → 1 column |
| 600 | Titles shrink to 26/32; 2-column forms → 1 column; confirmations dock at the bottom with buttons sharing the width; 3-up tiles → 1 column |

**Viewport (`@media`) breakpoints:**
- 480, 560 and 640 px: small components;
- 600 px: Admin's Work forms;
- 900 px: My work tiles → 1 column;
- 1100 px: wide tables get a `min-width` and scroll sideways.

A few `@media` rules follow the window, not the phone frame (section 12).

### 3.4 Grids

- **Two-column forms:** `repeat(2, minmax(0, 1fr))`, going to one column on phones.

  | Class | Gap | One column at |
  | --- | --- | --- |
  | `.grid2` | 20 / 16 | 600 |
  | `.iform__grid` | 16 | 640 |
  | `.wk-form` | 16 / 20 | 600 |
  | `.ops-form--2` | 16 / 20 | |

  A full-width field spans both columns (`.wk-form__wide`, `grid-column: 1 / -1`).
- **Page with a side column:** Home `1fr 320px` (gap 24); Announcements `1fr 320px`; the student record `276px 1fr` (gap 20).
- **Tiles:**
  - owner tiles: `repeat(4, 1fr)`, gap 12;
  - status tiles: `repeat(auto-fit, minmax(180px, 1fr))`;
  - My work tiles: `repeat(3, 1fr)`, gap 16.
- **Facts (label and value):** `repeat(auto-fill, minmax(min(100%, 240px), 1fr))`, gap 12 / 20.
- **Card lists:** `auto-fill minmax(...)`, from 180 px (types) up to 400 px (files).

### 3.5 Vertical rhythm

| Between | Spacing |
| --- | --- |
| Blocks on a list page (`.stu`, `.find`, `.ipage`, `.mbx`) | 20 |
| Blocks on a record or settings page (`.irecord`, `.record`, `.cfg`, `.irpanel`) | 16 |
| Blocks on an RP section page (`.page`) | 24 |
| Home: head to content | 32 (24 at 900 or less) |
| Home: main column | 24 (20 at 600 or less) |
| Home: side column | 16 |
| Page head: title to lead | 6 |
| Page head: titles to actions | 16 / 24 |

### 3.6 Card padding

- `.card` itself has no padding. Its parts set it:
  - surface background, 1 px `--line` border, radius 16, `--shadow-xs`.
- **24:** onboarding cards, the agreement card, confirmations, pop-up bodies.
- **20 / 24:** sections (`.irsec`), record heads (`.irhead`), the home summary.
- **20:** settings panels (`.cfg__panel`).
- **16:** small tiles and stats.
- **Phones:** 16 to 20.
- **Tables:**
  - the toolbar is 16 / 20 / 12;
  - cells are 14 / 12, with 20 on the first and last columns;
  - headers are 10 / 12 on `--surface-2`;
  - the pager bar is 12 / 20.

---

## 4. Page anatomy

### 4.1 The page head (every page)

`PageHead({ title, lead, children })`, in `institution/records/parts.tsx`:

```
[ h1 Title                          ]          [ Secondary ] [ + Main action ]
[ One-line lead, what the page is for ]
```

- **Title:** `.page__title`, `--t-display`, semibold, `-0.022em`.
- **Lead:** `.stu__lead`, `--t-subtitle`, line height 1.625rem, `--text-2`, at most 60ch. It's **one line**, never a paragraph.
- **Actions:** on the right (`margin-left: auto`), with 8 px between them. **The main action comes last** and is a primary button with an icon, such as "+ Create Queue".
- **Layout:** the head uses flex with `align-items: flex-end`.

### 4.2 List pages

Example: Recruitment partners, Applications, Students, My work. Top to bottom:

1. The page head.
2. **Tiles** that count and filter: `Tiles` / `.atiles`. They are toggle buttons with `aria-pressed`; clicking the active tile again clears it.
3. **One card** (`.card.stable`, padding 0) holding:
   - **the toolbar** (`.stools`):
     - a search box (`.ssearch`, 200 to 300 px);
     - filters, each a `Filter` / `MultiPick`, 44 px high, 130 to 190 px wide;
     - on the right, "Export as CSV" where the list is exported;
     - a count ("N partners").
   - **the table** (`.itab`, section 5.17);
   - **the pager:** **20 rows a page**, "Showing 1–20 of N", the first and last pages, the current page ±1, and the current page in navy.
4. **No results:** `NoMatch`, "No {things} match" with a **Clear filters** button.

### 4.3 Record pages

Example: a partner, university, course, recruitment partner or Master Partner.

1. A **back link** (`.rback`).
2. The **header card** (`RecordHead`, `.irhead`):
   - a 52 px mark;
   - the name (26 / 34);
   - key facts;
   - the status pill and "Last updated by … on …" on the right.
3. **One row of tabs** (`RecordTabs`, section 5.14). **Never tabs inside tabs.**
4. The tab's **sections** (`Section`, `.card.irsec`), each with an h2 title, a note and an action on the right.
5. Each section reads as **Facts** until **Edit** (section 6.7).
6. **Logs** is the last tab or a fold: a timeline of who did what and when.

### 4.4 Settings pages (GSP · Admin)

1. The page head, in Title Case.
2. **Panels** (`Panel`, `.card.cfg__panel`): a title (subtitle size, semibold), a note (`--t-label`, `--text-3`), and an action on the right.
3. **The panel is read-only until Edit** (the rule is in section 6.7; the component is `EditActions` in `admin/config/parts.tsx`).
4. Under the panel, **Logs (N)**: a fold with the last 10 changes (section 6.9).

### 4.5 Pop-ups

**Every pop-up is a `Sheet`, almost always centred.** Its rules, sizes and behaviour are in **section 5.10**, and confirmations are in **section 5.11**. On a page, a pop-up opens from the button that names it ("Create Queue", "Edit", "Assign").

### 4.6 Empty states

- **Nothing yet:**
  - a short title ("Nothing assigned to you");
  - a line saying where things come from ("New tasks appear here when a task rule fires.");
  - centred, padded 40 / 20 to 24.
- **No match:** "No {things} match" and **Clear filters** (`NoMatch`, `.snone`).
- **First run** (Applications): a path of owner-coloured stops explaining the stages (`.aempty`).
- **Empty sections stay in place** and say so; never hide them.

---

## 5. Components

All of these live in `src/components/` unless a path is given. CSS class prefixes follow each name.

### 5.1 Button: `Button` (`button.css`, `.btn`)

- **Props:** `variant` (`primary` by default, `secondary`, `ghost`, `link`), `size` (`md`, `sm`), `loading`, `block`, `iconLeft`, `iconRight`. The `type` defaults to `button`.
- **Base:**
  - height `--h-btn` 44, padding `0 24px`, radius pill, 1 px transparent border;
  - `--t-body` medium text, 8 px gap to the icon;
  - pressing scales it to 0.98.
- **Small:** 36 high, padding `0 16px`, `--t-label`.
- **Block:** full width.

| Variant | Background | Text | Border | Hover | Disabled |
| --- | --- | --- | --- | --- | --- |
| **primary** | `--primary` | `--on-primary` | none | `--primary-hover` + shadow | `--surface-3` / `--text-3` |
| **secondary** | `--surface` | `--text` | `--line-strong` | border `--text-3`, bg `--surface-2` | text `--text-3` |
| **ghost** | transparent | `--text` | none | bg `--surface-2` | text `--text-3` |
| **link** | none, auto height, padding `2px 0` | `--link` | none | underline at `currentColor` | |

- **Loading:** the button is disabled with `aria-busy`, and a 16 px spinner (700 ms) replaces the left icon.
- **Rules:**
  - **one primary button per area**;
  - Cancel is always secondary;
  - destructive confirmations say what they do ("Delete Queue"), not "OK".
- **Icon-only button (`.icon-btn`):** 32 × 32, pill, `--text-3`.
  - Hover: `--surface-2` background with `--text`.
  - It has a **44 px tap target** (`::after inset -6px`) and needs an `aria-label`.
- **Row actions in tables:** link buttons (Edit, Reassign, Assign).
  - "Mark as completed" is a link button in **`--ok` green**.
  - When there are two actions, they stack on two lines, aligned right.

### 5.2 Field: `Field` (`forms.tsx` / `forms.css`, `.field`)

- **Props:** `id`, `label`, `optional`, `required`, `hint`, `error`, `success`.
- **Layout:** a grid with 6 px between the label, the control and the message.
- **Label:** `--t-label` medium, `--text-2`.
  - Required fields add a `*` in `--brand-red-text`, plus a visually hidden "(required)".
- **Hint or message:** `--t-caption`, `--text-3`.
  - An error is `--bad` with the alert icon and `role="alert"`.
  - Success is `--ok` with the checkCircle icon.
- **Ids:** `${id}-hint` and `${id}-error`, wired through `aria-describedby` (the `describedBy()` helper).
- **Errors show after the first submit,** not while the person is typing.

### 5.3 Text input: `TextInput` (`.control`)

- **Box:** 48 high, `--surface` background, 1 px `--line-input` border, radius 12.
- **Input:** padding `0 16px`, `--t-input` (16 px), `--text`, placeholder in `--placeholder`.
- **Optional parts:** a leading icon (`--text-3`) and trailing items, such as `.inline-action` (36 high, `--primary-soft`, `--link`) or the password toggle.

| State | Look |
| --- | --- |
| Hover | border `--text-3` |
| **Focus** | border `--focus` + `--input-glow` |
| Invalid | border `--bad-dot`; when focused, a glow of `--bad-bg` |
| Valid | border `--ok-dot` |
| Disabled, read-only | `--surface-2` background; disabled uses a `--line` border and `--text-3` text |

- **There's no shared Textarea:** use `.control` with `height: auto`, a `min-height` of 84 px and `resize: vertical`.

### 5.4 Dropdown: `SelectInput`, `Dropdown`, `SelectMenu` (`SelectMenu.tsx`, `combobox.css`, `.smenu` / `.cbx__*`)

**Never use the browser's own select list.**

- **API:** `SelectInput` is written like a native select (`<option>`, `<optgroup>`, `value`, `onChange(e)`).
  - It renders a button, plus a hidden native `<select class="dd__native">` that holds the id, the value and the change event.
  - The visible button's id is `#<id>-field`.
- **Field:** like `.control`, 48 high, `--t-input`, a chevron on the right (12 px in), `--placeholder` when empty.
  - When open: a `--focus` border with the glow, and the chevron rotated 180°.
- **List:**
  - a white panel, padding 6, 1 px `--line` border, radius 12, `--shadow-pop`;
  - at most 300 to 320 px high;
  - as wide as the field, and at least 200 px;
  - it drops from the field, and opens upward when there's under 220 px below.
- **Options:** at least 40 high, padding `0 10px`, radius 6.
  - The highlighted option is `--surface-2`.
  - The picked one is medium weight with a `--link` tick.
  - Group headers are uppercase `--t-micro` in `--text-3`.
- **Keyboard:**
  - ↓, ↑, Enter or Space opens it;
  - arrows move, skipping disabled options;
  - Home and End jump;
  - typing jumps to a match;
  - Enter picks;
  - **Escape closes the list only** (it never closes the pop-up behind it);
  - Tab or a click outside closes it.
- **It renders into `#layer`.**
- **Long lists** use the searchable version: `CountryCombobox`, `CityCombobox`, `SearchPick`.

### 5.5 Searchable pickers: `CountryCombobox`, `CityCombobox`, `SearchPick` (`.cbx`)

All three are editable comboboxes (ARIA 1.2). Typing filters the list; arrow keys move; Enter or a click picks; **Escape puts back the last pick**.

- **Country:** the main markets first, then every country in groups. It also matches dial codes.
- **City:** lists the country's cities with their state, and picking one fills the state. A city that isn't listed can still be kept ("Use '…'").
- **SearchPick:** a generic `{ value, label, note }` list. Prefix matches come first. It's used for picking a person, for example to assign a task.
- **The list is inline** (absolute, z 30), not in `#layer`. Give the pop-up enough room: an assign pop-up's body has a minimum height of 340 px.

### 5.6 Multi-select: `MultiPick` (`multipick.css`, `.imp`)

Use it wherever several values can be picked: filters, members, countries.

- **Props:** `id`, `label`, `value[]`, `options[]`, `onChange`, `empty` (what an empty field shows, such as "All queues" or "Anyone"), `search`, `all`.
- **Field:** a `.control`, at least 48 high (44 in filter bars), the value in `--t-label`. It reads "A, B" or "A, B and N more", and shows `empty` in `--placeholder` when nothing is picked.
- **Panel:**
  - fixed position, z 80, at least 260 wide;
  - padding 10, 1 px `--line-strong` border, radius 12;
  - an optional search box (36 high);
  - checkbox rows, each at least 34 high, with a list at most 220 px high;
  - footer links **Clear** and **Done**.
- **Behaviour:** renders into `#layer`. Escape closes it and returns focus. Unticking doesn't ask first.

### 5.7 Switch: `Switch` (`.switch`)

- A `role="switch"` button.
- The label is on the left (`--t-body`, `--text-2`) and the switch on the right.
- **Track:** 38 × 22, pill-shaped.
  - Off: `--switch-off` with a `--switch-off-line` ring.
  - On: `--switch-on` (navy).
- **Knob:** 18 px, white, sliding 16 px on a 420 ms spring.
- **Tap target:** 44 × 32.
- **Use it for on and off** (a task rule, a setting). It saves straight away and logs the change.

### 5.8 Checkbox: `Checkbox` (`.check`)

- The native input is visually hidden.
- **Box:** 20 × 20, radius 5, a 1.5 px `--line-input` border.
  - Checked: `--primary` with a `--on-primary` tick.
- **Label:** `--t-body`, `--text-2`, 12 px from the box. An optional hint sits under it in `--t-caption`.
- **In tables** it's the first column (52 px wide), with an empty label and a visually hidden "Tick …".
  - The header checkbox ticks **every open row shown, across pages**.
  - Ticked rows turn `--primary-soft`.

**Radio buttons** have no shared component yet: use 18 px native inputs with `accent-color: var(--primary)` (`.cfg__radios`).

### 5.9 Phone number: `PhoneInput` (`phone.css`)

One `.control` holding:
- a dial-code dropdown, with a list at least 300 wide grouped into "Where most partners are" and "All countries";
- a number field (`type="tel"`, digits, spaces and dashes only).

### 5.10 Pop-up: `Sheet` (`sheet.css`, `.sheet`)

- **Props:**
  - required: `open`, `onClose`, `title`;
  - content slots: `sub`, `lead`, `band`, `nav`, `footer`;
  - layout flags: `center`, `modal`, `wide`, `expandable`, `keepCentre`;
  - `className`.

| Variant | Width | Use |
| --- | --- | --- |
| `center` (default choice) | `min(720px, 100%)`; forms often set `min(680px, 100%)` | **Almost every pop-up** |
| `modal` | `min(1040px, 100%)`; scrolls as one, close button pinned | The course dialog, large forms |
| `expandable` | toggles to fill the window | Add a student, New application |
| default (side panel) | `min(480px, 100% − 24px)`, 12 px from the edges, radius 24 | Find courses filters, document panels |
| `wide` | 640 px side panel | |

- **Head:** padding `24px 24px 16px`, bottom border `--line`.
  - Title: `--t-title` semibold.
  - Sub: `--t-label`, `--text-3`.
  - Close icon at the top right.
- **Body:** padding `20px 24px 24px`; it scrolls.
- **Foot:** padding `16px 24px 20px`, `--surface-2` background, top border.
  - Buttons sit at the right with 12 px between them, **Cancel first and the main action last**.
  - A note can fill the left.
- **The rules for every pop-up:**
  - the title is at the top left;
  - a **close icon** sits in the **top-right corner**;
  - the **buttons sit at the bottom right**: Cancel (secondary) first, the main action last;
  - **"\* Required"** sits above the form when any field is required;
  - **hints** are one short line under the field;
  - use `center` unless the form is long (`modal`) or needs the whole window (`expandable`). The side panel is only for filters and document panels.
- **Phones** (container 900 px or less; 600 with `keepCentre`): a bottom sheet.
  - It's at most 90% high, with radius `28px 28px 0 0` and a 40 × 5 grabber.
  - Padding becomes 12 / 16 / 20, with the safe area at the bottom.
  - The buttons share the width.
- **Behaviour:**
  - it renders into `#layer`, with `role="dialog"` and `aria-modal`;
  - focus moves to the close button and is trapped;
  - Escape or the scrim closes it, and focus returns to the opener;
  - the shell behind it is `inert`.

### 5.11 Confirmation: `ConfirmDialog` / `useConfirm()` (`confirm.css`, `.confirm`)

Use it for **every remove, delete, deactivate or unlink of something saved.**

- **How to write it:**
  - the title is the question ("Delete Nepal Admissions?");
  - the body says what happens next ("Its 4 kinds of work go to the Admin queue…");
  - the confirm button uses the action's own words ("Delete Queue"), never "OK".
- **Props:** `open`, `title`, `children` (what happens), `confirm` (the action word), `cancel` ("Cancel", or "Keep" in GSP · Admin), `onConfirm`, `onCancel`.
- **Box:** `min(440px, 100%)`, padding 24, radius 24, `--shadow-pop`.
  - Title: `--t-subtitle` semibold.
  - Text: `--t-label`, `--text-2`.
  - A close icon sits at the top right.
  - Buttons sit at the right: Cancel (secondary), then confirm (primary).
- **Phones** (600 or less): it docks at the bottom, with the buttons in two columns.
- **Behaviour:** `role="alertdialog"`. **Cancel gets focus first.** Escape or the scrim cancels.
- **Doesn't need to ask:** removing a file just picked in a form before it's saved, unticking in a multi-select, unstarring a course, or taking a person out of a list being edited.

### 5.12 The ⋯ menu: `MoreMenu` (`menu.css`, `.mmore` / `.mmenu`)

- **Props:** `id`, `label` (an accessible name, such as "More for India Admissions"), `items: { id, label, icon, danger, checked, onPick }[]`.
- **Trigger:** a 40 × 40 circle. Variants: a word, a small button, a 44 px tool.
- **Menu:**
  - at least 220 wide, padding 6, radius 16, `--shadow-pop`;
  - items 42 high, radius 10, `--t-label` medium, icons in `--text-3`;
  - a danger item is `--bad`.
- **Behaviour:**
  - it renders into `#layer`, aligned right, and opens above when there's no room below;
  - arrows wrap, and Home and End jump;
  - Escape closes it and returns focus.
- **A menu has no close icon:** a click outside closes it.
- **Order:** Edit first, destructive actions last.

### 5.13 Chips: `.ichip` (`institution/institution.css`)

A toggle button (`aria-pressed`) for views and filters, such as "Assigned to me 5".

- **Base:** 36 high, padding `0 14px`, pill, 1 px `--line-strong` border, `--surface` background, `--t-label` medium, `--text-2`.
- **Pressed:** inverted, with `--text` background and border and `--surface` text.
- **Count badge:** a 20 px pill in `--surface-2` (`--t-micro`).
- **Height:** 40 in view switchers; 44 in toolbars.
- **Chips are filters, not tabs.**

**Removable chip:** `.cfg__chip`, 28 high, `--primary-soft`, `--link`, with an × button.

### 5.14 Tabs: `RecordTabs` + `TabPanel` (`.atabs` / `.itabs`)

- **Track:** a pill-shaped `--surface-2` track, padding 4, 4 px between tabs. It scrolls sideways on phones.
- **Tab:** 40 high, padding `0 16px`, `--t-label` medium.
  - The selected tab sits on a white lens with a soft shadow, sliding on a spring.
  - An optional count (`--text-3`) or badge (a 20 px pill) follows the label.
- **Behaviour:** `role="tablist"` with a roving tabindex. Left and right arrows wrap; Home and End jump.
- **Rules:**
  - **one row per page**;
  - labels follow the role's case (Title Case in GSP · Admin);
  - empty tabs stay and say so.

### 5.15 Pills and status tags

| Class / component | Size | Use |
| --- | --- | --- |
| `.who` (`base.css`) | 20 high, `--t-micro` medium, 6 px dot | **Who has it:** `--you`, `--gsp`, `--uni`, `--ok`, `--end` |
| `Pill({ tone })` / `.dpill` | 24 high, `--t-micro` medium, 6 px dot | Record and document status. Tones: ok (Live, Verified), gsp (Checking, Setting up), you (Missing, Paused), bad, uni, grey (Ended, Hidden) |
| `.cfg__state` | 26 high, `--t-caption` semibold, 7 px dot | Active or inactive in settings; `.is-on` is green |
| `.cfg__tag` | 22 high, `--t-caption` medium | Labels; `--soft` is navy-soft; `--dl` is violet |
| SLA pill (`.mw-pill`, `.gw-pill`…) | 26 high, `--t-caption` semibold, 7 px dot | On track (green), Due soon (grey with a red dot), Breached (red), Paused and Completed (grey) |
| `RankTag` / `.arank` (`components/RankTag.tsx`, 6 Nov) | 22 high, `--t-caption` medium | An application's rank for its student: **Primary** (`--primary-soft`, `--link`, a 12 px filled star) or **Secondary** (`--surface-2`, `--text-2`, a 1 px `--line` ring). Under the student's name in applications lists (`.arow__rank`) and on the application page (`AppRank`, `.ahead__rank`), where GSP · Admin and GSP · Admissions get a **Mark as Primary** link (`--t-caption` medium, `--link`), asked first |
| `.astat` + `.smeter` | | Application status in tables: the owner word with a dot, the status, and a 9 × 6 segment stage meter |

Every pill has a dot **and** a word. Labels (`.cfg__tag`, `.arank`) are a word only.

### 5.16 Tiles

- **Owner tiles** (`.atiles` / `.atile`): **4 across**, gap 12; 2 across at 760 px or less.
  - Each tile is a button, padding `16px 16px 14px 20px`, 1 px `--line` border, radius 16, `--shadow-xs`.
  - A **4 px coloured bar** runs down the left (`--tone`).
  - The number is 2rem semibold; the label is `--t-label` semibold.
  - Pressed: a `--tone-line` border, a gradient from `--tone-bg`, and `--shadow-card`.
- **Status tiles** (`Tiles` in `institution/records/parts.tsx`, `.itiles`):
  - `auto-fit minmax(180px, 1fr)`;
  - tones ok, you, gsp, bad, uni, grey;
  - a sub line in `--t-caption`;
  - clicking the pressed tile again clears it.
- **Count tiles** (My work):
  - 3 across, gap 16 (1 across at 900 px or less);
  - padding `20px 24px`;
  - the number is `--t-display` semibold, with the label and sub line under it.
  - The number turns `--bad` when there's something breached.

### 5.17 Tables: `.itab` (+ `.cfg__tab` in GSP · Admin)

- **Table:** full width, collapsed borders, `--t-label`.
- **Header:** padding `10px 12px`, `--surface-2` background, bottom border, `--t-caption` medium, `--text-3`, no wrapping.
- **Cell:** padding `14px 12px`, bottom border `--line`, `--text`, aligned to the top when cells hold two lines.
- **First and last columns** are padded 20.
  - The first column is at least 240 px (180 in settings). **Set `min-width: 0` when the first column is a tick box.**
- **Two lines in a cell:** the main value in `.cfg__strong` / `.gw-strong`, and a sub line in `.cfg__sub` (`--t-caption`, `--text-3`).
- **Clickable rows** (`.irow`): a light hover, and the name underlined on hover.
- **Actions** sit in the last column, aligned right, 1% wide.
- **Wide tables** use `table-layout: fixed` with pixel widths on the side columns, so the main column gets the rest.
  - Under 1,100 px they keep a `min-width` and scroll inside `.stab-wrap` (`overflow-x: auto`).
- **Long words** (emails) wrap: `overflow-wrap: anywhere`.
- **Numbers** use `.num` and don't wrap.
- **Rows:** `.is-off` is grey with a line through the name; `.is-changed` is navy-soft while it's being edited.

### 5.18 Pager: `Pager` / `usePaged` (`.ipager`, `.cfg__pager`)

- **20 rows a page** (`PER_PAGE = 20`); 40 on logs.
- **Behaviour:**
  - hidden when there's only one page;
  - it goes back to page 1 when a filter changes;
  - it shows the first and last pages, the current page ±1, and "…" gaps.
- **Bar:** space-between, padding `12px 20px`, top border, with "Showing 1–20 of N {things}" in `--t-label`.
- **Buttons:** at least 36 × 36, 1 px `--line` border, radius 10, `--t-label` medium.
  - The current page is `--primary` with `--on-primary` text.
  - Disabled buttons drop to 0.4 opacity.
- There are two copies of the same logic (section 12).

### 5.19 Cards and sections

| Component | Classes | Spec |
| --- | --- | --- |
| `.card` | | `--surface`, 1 px `--line`, radius 16, `--shadow-xs`, no padding |
| `Section` | `.card.irsec` | Padding 20 / 24 (16 at 640 or less); h2 at `--t-subtitle` semibold; note at `--t-caption`, max 72ch; action on the right |
| `Panel` (Admin) | `.card.cfg__panel` | Padding 20, gap 16. `flush` puts a table edge to edge, with the head padded `20px 20px 16px` and a bottom border |
| `Fold` | `details.card.ifold` | A head at least 60 px high, a 24 px count pill, a rotating chevron |
| `Facts` | `.ifacts` | Label `--t-caption` `--text-3`; value `--t-label` `--text`. "Not added" shows in grey |

### 5.20 Toast: `Toast` (`toast.css`)

- **Where:** **the bottom left**, beside the sidebar: fixed, z 70, `left: calc(sidebar + 36px)`, bottom 24, at most 420 wide.
  - On phones: left 16, bottom 150.
- **Card:** padding 12, radius 14, 1 px `--line` border, a soft drop shadow. The icon, the words and × are **centred on one line**, whether the message has one line or two.
  - A 34 px icon tile: grey, green (`ok`) or amber (`star`).
  - The title is `--t-label` semibold; an optional line sits under it in `--t-caption`.
  - An optional link, and a × button.
- **Behaviour:** it goes after 6 seconds. `aria-live="polite"`.
- **Say what happened, in past tense:** "Nepal Admissions deleted."

### 5.21 Frame components

- **`AppShell`** (`shell/`): section 3.1. Props: `sidebar`, `footer`, `topEnd`, `corner`, `tabbar`, `inert`, `brand`.
- **`AuthScene`:** sign-in and registration.
  - A crossfading photo on the left and a glass panel on the right.
  - Panel width `clamp(420px, 34cqw, 500px)`; registration uses `clamp(500px, 40cqw, 600px)`.
  - Radius 32. The panel padding is `clamp(32px, 3.9cqw, 56px)`, and its top and bottom bars are 52 px.
  - Narrow (900 px or less): the photo becomes a 360 px band on top (196 px for registration) and the panel stacks below.
- **`AccountMenu`:** at the sidebar foot.
  - A 36 px avatar with initials, the name and role.
  - It opens a glass menu upward: "Signed in as", the email, and Sign out.
- **`ThemeToggle`:** a pill-shaped radio group, Light (sun) and Dark (moon), with a sliding thumb. The choice is remembered (`gsp-theme`).
- **The bell and megaphone:** 44 px glass circles with an unread count. Each opens a glass panel that also has a close icon.
- **GSP · Admin's flyout** (`admin/portal/Flyout.tsx`, `.pfly`):
  - choosing a menu group opens a glass menu 10 px to the right of the sidebar, level with the group;
  - at least 260 wide, padding 8, radius 24;
  - items 42 high, radius 12;
  - `role="menu"`; Escape or ← closes it.

### 5.22 Other shared pieces

- `DocView`: Preview and Download icon buttons (32 px) and a paper preview pop-up.
- `CodeInput`: the email code at registration.
- `PasswordInput`: shows and hides the password, and warns about Caps Lock.
- `RangeSlider`.
- `CounsellorPicker`.
- `ContactCard`.
- `BrandLockup`: the logo plus the role label, 34 px high (28 on phones).
- `Celebrate`: peak moments.
- `ErrorBoundary`.

---

## 6. Patterns

### 6.1 Who has it, and the 8 stages

- **The stages:** New → Pre-screening → Application → Offer → Verification → Acceptance → Visa → Enrolment (`STAGES`, `data/applications.ts`).
- **Every status** has one owner (`you`, `gsp` or `uni`, or `done` or `end`) and plain words.
- **In tables:** the owner word with its dot, then the status, then the stage meter (`.astat`, `.smeter`).
- **On the application page:** the header names the next step and who has it. The chat shows the same.
- **Agencies never see internal statuses or staff checks.**

### 6.2 SLA status (My work, every GSP role)

| Status | Pill | Line under it |
| --- | --- | --- |
| On track | green | "Due in N working hours" (today) or "Due Fri 6 Nov" |
| Due soon (within a working day) | grey with a red dot | "Due in N working hours" or "Due today" |
| Breached | red | "Late by N working days" |
| Paused (GSP · Admissions) | grey | "Paused while the RP answers: {what was asked}" |
| Completed | grey | "Done in time", or "Done N late" |

- **Times count working time** on the record's calendar (GSP · Admin › Work › Working Days), always in IST.
- **Short forms in tables:** `wh` (working hours), `wd` (working days), `days` (calendar days).
- **Escalated tasks** add "· Escalated to {queue}" under the task.

### 6.3 Filters

- Every filter is a dropdown, or a **multi-select** where several values fit.
- Filters sit in the toolbar, left to right, after the search.
- The empty value names the whole set: "All queues", "Any SLA status", "Anyone".
- **"Clear filters"** (a link button) appears once any filter is set.
- Ticks and pagers reset when the filters change.

### 6.4 Bulk actions

- A tick box is the first column, and the header box ticks every open row shown.
- Once anything is ticked, a bar appears above the table: "**N** ticked", then **Assign N** (a small primary button), then **Clear**.
- The bulk pop-up is titled "Assign N tasks" and says "To one person. Only these tasks move."

### 6.5 Assigning people

- Pick from the people in the task's queue, with a searchable list (`SearchPick`).
- Mark the leader "(leader)" and yourself "(you)".
- The main button reads **Assign** or **Reassign**, and stays off until someone new is picked.

### 6.6 Forms

- Ask only what's needed now, and prefill what's known.
- Use two columns on wide screens and one on phones. A full-width field spans both columns.
- Validate on submit, show messages under the field, and keep **Save** on while errors show.
- Use **number steppers** (− and +, 168 px wide, 36 px round buttons) for small whole numbers, such as an SLA or escalation days.
- Use time fields for times, in IST.

### 6.7 Read-only until Edit

- Settings and record sections show **Facts** until **Edit** (secondary, with the edit icon).
- While editing, the panel shows **Cancel** and **Save Changes**, which is off until something changes.
- An edited row is tinted navy-soft.
- Saving logs who changed what, and when.

### 6.8 Confirmations

**Every remove, delete, deactivate or unlink of something saved asks first.** How to write and build the confirmation, and what doesn't need one, is in **section 5.11**.

### 6.9 Logs

- "Change log" and "Activity" are both called **Logs**.
- Every record and setting has one: a timeline of who did what and when, the newest first, with 40 shown before "Show N older" (10 in settings folds).
- Automatic steps name the system as the actor.

### 6.10 Mail threads (Inbox, every GSP role)

- **In the list:** a thread's row names who wrote, in order (“me” once you've replied), and a count pill after the subject (`.mbx__n-msgs`, 18 px, `--surface-3`).
- **Reading it:**
  - the subject, with an “N messages” tag (`--primary-soft`, `--link`);
  - the actions (Reply, Reply all, Forward, Archive, Mark as unread, Summarise) act on the thread;
  - the earlier messages, **oldest first**, each **folded to one line** in a bordered card (`.mbx__msg`, radius 12): avatar, who, the first words, an attachment icon, when. A click opens it, with a chevron to fold it again;
  - **Expand all** / **Collapse all** (a link button) over the list;
  - the **Latest** message last, always open, with a stronger border and `--shadow-xs`.
- **Replying:** a reply joins the thread as its latest message (a copy goes to Sent). A forward starts a new mail.
- **Quoted text** under a reply isn't shown in the thread; each message shows only its own words.

### 6.11 Notifications and announcements

- **The bell:** System, Chat and Mail notifications.
- **The megaphone:** universities' announcements (Intakes, Courses, Scholarships, Entry).
- Both sit at the top right on every page, with unread counts and a glass panel.
- A notification about another role's action also shows as a toast.

### 6.12 Mail categories (Inbox, every GSP role)

- **GSP sorts each mail as it arrives** into one of four categories:
  - **Not linked:** GSP couldn't place it. It waits for someone to link it or forward it;
  - **Linked to an application:** matched to one, or linked by hand. The mail shows the application's card;
  - **Forwarded:** sent on to another of GSP's inboxes;
  - **Others:** miscellaneous, not about an application (training, finance runs, invites, course data).
- **Picking one:** a **Category** dropdown in the toolbar, after the email group: All categories, then the four, each with its count in the current folder, group and search. Neither dropdown shows a label above it; the value says what it is (the label is there for screen readers). The count sits before the arrow, never under it. The list's heading adds the category ("Inbox · All inboxes · Not linked").
- **In the list:** a **Not linked** tag (`--you-bg`, `--you`: it's with you), the application's number on a linked mail, and a forward icon with the inbox on a forwarded one.
- **The nudge** on a Not linked mail, above its text (`.mbx__nudge`, radius 14, `--you-line` border on a `--you-bg` wash):
  - an icon, **Not linked to an application**, and one line on what to do;
  - **Link it to an application:** a dropdown of applications (student · university, the number as its note; students the mail names come first) and **Link** (primary, with the attach icon);
  - an **“or” divider** between the two (a line with “OR” in a small pill, `--you-line`), so it reads as one choice, not two fields to fill;
  - **Forward it to another inbox:** a dropdown of GSP's other inboxes and **Forward** (secondary, with the forward icon);
  - **both buttons are 128 px**, so both dropdowns are the same width. Stacked, with the divider across; side by side, with the divider standing between them, from 900 px; under 480 px each button goes under its dropdown, full width;
  - pressing Link or Forward with nothing chosen shows the field's error ("Choose the application this mail is about.").
- **After linking:** the nudge goes, the application's card shows, and the mail moves to Linked to an application. **After forwarding:** a grey note says where it went and who sent it ("Forwarded to GSP Commission by you, 2:14 pm"); the inbox it went to gets a copy, unread and Not linked, with a note saying where it came from.

---

## 7. Writing

- **Plain, short words, in UK spelling:** colour, organise, enrolment.
- **Curly apostrophes and quotes in UI copy:** ’ “ ”.
- **Every word on a page comes from a defined data field.** Don't add decorative copy.
- **One-line leads** under page titles. **One-line hints** under fields.
- **Case:**
  - **GSP · Admin's own pages use Title Case** for page titles, the menu, pop-up titles, tabs and every button: "Create Queue", "Save Changes", "Mark as Completed".
  - **Every other role uses sentence case:** "Create queue", "Mark as completed", "My work".
  - Pages GSP · Admin borrows from GSP · Institution keep sentence case.
- **Buttons say what they do:** "Delete Queue", "Send agreement", "Assign 3". Use **Cancel** for leaving a form and **Keep** for declining a delete (GSP · Admin).
- **Words fixed by review:**
  - **"Pending on you"**, not "Pending from you";
  - **"Program Level"** and **"Study Area"**;
  - **"entry requirements"**, never "assessment criteria";
  - **Logs**.
- **Never guess pronouns.** Use the name, or they/them.
- **Dates:** "Fri 6 Nov", "5 Nov 2026". **Times:** "9:30 am IST".

---

## 8. Roles and pages

Twelve roles share the same tokens, frame and components, plus a reference copy of RP Admin (below). Only the content, the menu and the text case differ. A change for one role never reaches the others unless the change says "every role".

| Role (code key) | For | Signed in as | Label by the logo | Folder | Case |
| --- | --- | --- | --- | --- | --- |
| **RP Admin** (`rp-admin`) | The agency's admin | Asha Menon, BrightPath Overseas | Partner Portal | `src/screens` | sentence |
| **RP Admin (Backup - not for Engineering)** (`rp-admin-backup`, 6 Nov) | A reference copy of RP Admin as it stood on 6 Nov; **don't build from it** | Asha Menon | Partner Portal | `src/screens` (the same portal) | sentence |
| **GSP Branch Manager** (`rp-branch`, 6 Nov) | An agency branch's manager | Meghna Rao (Mumbai branch) | Partner Portal | `src/screens` (RP Admin's portal, `seat`) | sentence |
| **GSP Counsellor** (`rp-counsellor`, 6 Nov) | An agency counsellor | Karthik Nair | Partner Portal | `src/screens` (RP Admin's portal, `seat`) | sentence |
| **GSP · Admissions** (`gsp-team`) | GSP's admissions officers | Freddy Forrest | GSP Admissions | `src/gsp` | sentence |
| **GSP · Institution** (`institution-partner`) | GSP's Institution Team | Raj Shamani | Institution Team | `src/institution` | sentence |
| **GSP · Admin** (`gsp-admin`) | GSP's admins | Ishaan Verma | GSP Admin | `src/admin` | **Title Case** |
| **GSP · RP Ops** (`rp-ops`) | GSP's team for recruitment partners | Rohan Desai | GSP RP Ops | `src/rpops` | sentence |
| **GSP · Finance** (`gsp-finance`) | GSP's Finance team | Rhythm Jain | GSP Finance | `src/finance` | sentence |
| **GSP · Global Ops** (`gsp-globalops`) | GSP's Global Ops team | Neha Kulkarni | GSP Global Ops | `src/globalops` | sentence |
| **GSP · Recruitment** (`gsp-recruitment`) | GSP's Recruitment team | Aditya Rao | GSP Recruitment | `src/recruitment` | sentence |
| **GSP · Institution Ops** (`gsp-instops`) | GSP's Institution Ops team | Riya Sen | GSP Institution Ops | `src/instops` | sentence |
| **GSP · View Only** (`gsp-view`) | GSP people who only need to look | Tanvi Kapoor | GSP View Only | `src/institution` (with `viewOnly`) | sentence |

### 8.1 RP Admin (the agency portal)

**Menu:** Home, Find courses, Applications\*, Students\*, Earnings\*, Profile.
- The starred items are locked until GSP verifies the agency: a lock icon, and a locked page that says when they open.
- **Phone tabs:** Home, Find courses, Applications, Students, Earnings.

| Page | Patterns |
| --- | --- |
| Sign in, Become a partner, Check your email | `AuthScene`: photo and glass panel; forgotten password; email code (`CodeInput`) |
| Home while registering | Setup steps (`.sstep` / `.scard`), verification track (`.vtrack`), document list (`.ldoc`), partner agreement (`.agr`), the GSP contact |
| Home once verified | Summary: 4 KPI tiles (`.hkpi`), to-do rows, stage bar |
| Find courses | One forgiving search (`.fsearch`); sticky filters (a bottom sheet at 1,100 px or less); course cards; compare; shortlist; Student view hides earnings; course dialog (`modal`, `expandable`) with tabs Overview, Costs, Eligibility and documents, University |
| Applications | Page head; 4 owner tiles; toolbar; application table (`.astat`) |
| Application | Header (`.ahead`) with stages and next step; tabs Chat, Documents, Logs; side column; GSP Assist |
| New application | Centred, expandable pop-up with an eligibility check |
| Students | Page head; empty state; table (cards at 760 px or less) |
| Student record | Header (`.rhead`); side nav (Personal details, Documents, Applications) |
| Add a student | Centred, expandable pop-up; passport autofill; duplicate check |
| Earnings | Locked until the agreement is accepted |
| Profile | Tabs Business details (Facts), Documents, Branches and team (table + 520 px pop-up), Email preferences |

### 8.1a GSP Branch Manager and GSP Counsellor

The agency's own people (Nesil, 6 Nov, from the access sheet; the two columns are the same): RP Admin's portal with a **seat**.

- **Menu:** Home, Find courses, Applications, Students. No Earnings (commission –), no agency Profile (the initials open the person's account), no My work, Mail or GSP pages.
- **E:** Find courses (**commission –**: no Base commission, commission sort, Compare row or Student view switch), Students (list, record, documents), Applications (list, record, **Chat**, **Documents**). **–:** an application's Mail and Submission (RP Admin has neither) and commission (no Base commission).
- **Whose:** the Branch Manager sees the students (and their applications) whose counsellor is in their branch; the Counsellor, only their own.
- **Code:** `Seat` in `src/screens/portal/Portal.tsx` (`kind`, `member`, `title`); the seats are set in `App.tsx`.

### 8.2 GSP · Admissions

**Menu** (6 Nov, Nesil's access sheet): Home, Inbox, **My work**, Find courses, Applications, Students, **Recruitment partners**, **Universities**, **Courses**. No Earnings, no agency Profile (the initials open the officer's account), no Master Partners, Institution partners or Announcements.
- **Phone tabs:** Home, Inbox, Find courses, Applications, Students.

| Page | Patterns |
| --- | --- |
| Home | Greeting, tiles |
| Inbox | `MailInbox` (`.mbx`): shared GSP mailboxes, list and reading pane |
| **My work** (`src/gsp/work`, prefix `gw-`) | 3 count tiles; views Assigned to me, My team, Waiting on others; SLA status and Assigned to filters; tick to assign; Reassign above a green Mark as completed; the record is the application (GSP number, university · region); paused SLAs |
| Applications, Application | As RP Admin, plus the status pop-up with reasons, document review (accept, or send back with a reason), mail to universities, Submission, census and fees, document requests; tabs Chat, Mail, Documents, Submission, Logs |
| Find courses, Students | As RP Admin; **no commission** in Find courses (cards, pop-up, Compare, sort, no Student view switch) |
| **Recruitment partners** (RP Ops' page) | View only: list and record (Overview and Logs); no Documents and agreements, Branches, Team, commission statements email or Master Partner |
| **Universities**, **Courses** (GSP · Institution's pages) | View only, every tab (Scholarships, Territory, Submission and contacts; Academic, English); no Update QS ranking |

- **Access, by the 6 Nov sheet:** E for My work, Mail, Find courses, Students (list, record, documents) and Applications (list, record, Chat, Mail, Documents, Submission); V for Recruitment partners, Universities and Courses; commission – everywhere (no Base commission on an application). The view-only pages carry the line "View only: Admissions can look at this page, not change it."

### 8.3 GSP · Institution

**Menu:** Home, Inbox, **My work**, Students, Applications, Course search, Recruitment partners, **Master Partners** (6 Nov), Institution partners, Universities, Courses, Announcements.
- **Phone tabs:** Home, Applications, Universities, Courses, Institution partners.
- **Access, by the 6 Nov sheet:** E for My work, Course search (commission –), Institution partners (Documents, Commission), Universities (Update QS ranking, Scholarships, Territory, Submission and contacts); V for **Mail**, **Students** (list, record, documents), **Applications** (list, record, Chat, Mail, Submission; Documents and commission –), **Recruitment partners** (RP Ops' page: Documents, Agreement, Branches, Team; commission –), **Master Partners** (Documents and Commission –), **Courses** (Academic, English) and **Announcements**. The view-only pages carry "View only: the Institution Team can look at this page, not change it." GSP · View Only has the same menu, all view only but Course search, without the sheet's hidden items.

| Page | Patterns |
| --- | --- |
| Home | Work queue: Tiles, Filter, table, Pager |
| **My work** (`src/institution/work`, `iw-`) | As Admissions; the Institution queue; the record is the institution partner; Queues filter |
| Students, Applications | List page with Pager (20 a page) |
| Recruitment partners | RP Ops' page since 6 Nov, view only: Overview (with Branches and Team), Documents (with agreements), Logs |
| Master Partners | RP Ops' page, view only: Overview, RPs, Logs |
| Institution partners | List; record tabs Overview, Universities, Documents, Commission, Contacts |
| Universities | List + CSV import; record tabs Overview, Campuses, Images, Courses, Scholarships, Territory, Submission, Logs |
| Courses | List; record tabs Basics, Intakes, Fees, Academic, English, Logs, each read-only until Edit |
| Announcements | List; form with preview (`.ianbody`, `1fr 320px`), System info and Logs folds |

### 8.4 GSP · Admin

**Menu:**
- Home, Inbox and **My Work** on their own.
- Then **8 groups**, each opening a flyout:
  - **User Modules:** Course Search, Students, Applications;
  - **Institution:** Recruitment Partners, Institution Partners, Universities, Courses, Announcements;
  - **User Roles:** Create Roles, Sales Regions, Permission Roles, Emails;
  - **Work:** Queues, SLA and Escalation; Task Rules;
  - **Recruitment:** BDM Assignment;
  - **Course Configuration:** Currency Exchange, Living Costs and Fees, Course Tags, Program Level Configuration, Grade Conversion, English Test Equivalence;
  - **Application Configuration:** Application Routing, Document Configuration;
  - **Other Configurations:** Logs.

The group holding the current page wears the lens.
- **Phone tabs:** Home, Applications, Universities, Application Routing, Logs.

| Page | Patterns |
| --- | --- |
| My Work (`src/admin/config/MyWork.tsx`, `mw-`) | Tiles; views Assigned to me, All work, Waiting on others; multi-select Queues, SLA status, Assigned to; tick to assign; Reassign above a green Mark as Completed |
| User Modules, Institution | GSP · Institution's own pages (sentence case) |
| Every configuration page (`src/admin/config/*`) | Page head, `Panel`, table, `EditActions` (Edit → Cancel and Save Changes), Logs fold, Pager, confirmations |
| Sales Regions | Tabs Sales Regions and Nationality Map |
| Queues, SLA and Escalation | Tabs Queues (3 groups; Create and Edit Queue pop-ups listing members), Kinds of Work (Add and Edit pop-ups with a Due in stepper), Working Days (one full-width card per calendar: days, regions, holidays), Reminders and Escalation (5 steps, read-only until Edit, steppers) |
| Task Rules | Area chips (filters); a table per area (#, when and task, goes to, starts after, SLA, RP reminded, On switch, Edit); short Edit pop-up with time fields (working hours, working days or calendar days); Requests People Can Raise |
| Logs | Table with Source, Role and Sales region filters; CSV |

### 8.5 GSP · RP Ops

**Menu:** Home, Inbox, **My work**, Applications, Students, Course search, Recruitment partners, Master Partners, **Institution partners** (6 Nov).
- **Phone tabs:** Home, Inbox, Applications, Recruitment partners, Master Partners.
- **Access, by the 6 Nov sheet:** E for My work, Course search (commission –), Recruitment partners (record, **Commission**, Documents, Agreement, Branches, Team), Master Partners (Documents, Commission) and **Institution partners** (Documents, Commission); V for **Mail** (the Inbox reads and searches), **Students** (list, record, documents) and **Applications** (list, record, Chat, Documents); – for an application's Mail, Submission and commission, Universities, Courses, Announcements. The view-only pages carry "View only: RP Ops can look at this page, not change it."

| Page | Patterns |
| --- | --- |
| Home | Queue: Tiles, filters, table |
| **My work** (`src/rpops/work`, `rw-`) | As Institution's; the RP Ops queue; the record is RP and its region |
| Applications, Students, Course search | GSP · Institution's pages |
| Recruitment partners | Toolbar (`.ops-tools`); record head; tabs Overview, Documents (Verify, or Reject and send back with a note), Agreement (send, then accept or send back the signed copy, with versions), Logs |
| Master Partners | List; New Master Partner; tabs Overview, RPs (Link an RP), Documents, Commission terms, Logs |
| Institution partners | GSP · Institution's page, to use (6 Nov) |

### 8.6 GSP · View Only

**Menu:** GSP · Institution's, as it is: Home, Inbox, My work, Students, Applications, Course search, Recruitment partners, Institution partners, Universities, Courses, Announcements.

- **Everything is view only except Course search.** Pages show what's there; every way to change something is left out: add, edit, delete, status changes, assign, send, upload, link, forward, archive, connect. Looking, searching, filtering, sorting, opening records and tabs, previewing and downloading stay.
- **The view-only line** at the top of every page but Course search: `.iviewonly` (the eye icon, `--surface-2`, caption text), "View only: you can look at everything here. Course search is the one page you can use."
- **What goes, by place:**
  - list pages: Add, Import CSV, Update QS ranking, New announcement;
  - records: status actions (Go live, Pause, Resume, Publish, Hide, Change status), Edit, Edit profile, Add/Remove in each section, the territory, image and submission editors, the partner and counsellor pickers (the counsellor shows as a name);
  - forms that open from a record (an announcement) show locked, without the formatting bar; an empty student section reads instead of opening for editing;
  - applications: Change status, Review, Accept/Reject, Request, Upload, Withdraw, the editable dates; Chat shows its messages with "View only: you can read this chat, not write in it." in place of the message box;
  - My work: no tick column and no actions column;
  - Inbox: read and search only; no New mail, Connect inboxes, Reply, Forward, Archive, Mark as unread or the link-or-forward nudge; a draft opens to read.
- **Course search** works as in GSP · Institution, Apply included; an application started there opens its form, and then reads like the rest.
- **Code:** `ViewOnlyProvider`, `useViewOnly` and `EditOnly` (`src/proto/viewOnly.tsx`). The portal turns it on for every page but Course search; a control that changes something is wrapped in `<EditOnly>` or reads `useViewOnly()`. Every other role is outside the provider, so nothing changes for them.

### 8.7 GSP · Finance

**Menu:** Home, Inbox, My work, Students, Applications, Course search, Recruitment partners, **Master Partners**, Institution partners, Universities, Courses. No Announcements. Recruitment partners and Master Partners are RP Ops' pages.

| Page | Access |
| --- | --- |
| Inbox, My work (`src/finance/work`: the Finance queue's commission claims, invoices, remittances and payouts) | Use |
| Students | Use; a student's **Documents** view only |
| Course search | Use, **without commission** (no Base commission on cards, in the pop-up or in Compare, no commission sort, no Student view switch) |
| Applications | View. The application page has only **Commission** (can be changed) and **Logs**: no Chat, Mail, Documents or Submission, and no document banners |
| Recruitment partners | View (Overview with branches and team, Documents with the agreements, Logs); a **Commission** tab (can be changed) |
| Master Partners | View; the **Commission** tab can be changed |
| Institution partners, Courses | View |
| Universities | View, without QS ranking, Scholarships, Territory, or Submission and contacts |

- **The view-only line** on every page Finance only looks at: "View only, except commission: Inbox, My work, Students and Course search are yours to use."
- **Commission, on an application** (`CommissionTab`, `.acom__*`): Status (Not due, Due, Claimed, Invoiced, Paid, On hold, Not payable, as pills), the amount (from the course's base commission until saved), the invoice number, invoiced and paid dates, a note, who changed it last. **Edit** opens the fields in place; Invoiced and Paid need the invoice number, Paid needs the date; Save writes to Logs.
- **Commission, on a recruitment partner** (`RpCommissionTab`): payouts Paying or **On hold** (with why; held to begin with while no agreement is accepted), the plan (Standard, Tiered, Custom), the partner's share (%), how often it's paid, statements email, tax ID, bank account (last four digits shown). Edit in place; Save writes to Logs.
- **Code:** `AccessProvider` with `hide` and `show` lists, read with `useHides` and `useShows` (`src/proto/viewOnly.tsx`); the Finance portal sets them with `ViewOnlyProvider` per page (`EDIT` in `src/finance/portal/model.ts`), and a Commission tab re-opens editing inside a view-only page with `<ViewOnlyProvider on={false}>`.

### 8.8 GSP · Global Ops

**Menu:** GSP · Institution's, with **Master Partners** after Recruitment partners: Home, Inbox, My work, Students, Applications, Course search, Recruitment partners, Master Partners, Institution partners, Universities, Courses, Announcements. Built from Nesil's access sheet (E edit, V view, – not shown):

| Page | Access |
| --- | --- |
| My work (`src/globalops/work`: the Global Ops queue), Inbox | E |
| Course search | E; commission – |
| Students (list, record, documents) | E |
| Applications (list, record, Chat, Mail, Documents, Submission) | E; commission – (no Base commission in Key details) |
| Recruitment partners (RP Ops' page) | V; Documents and agreements, Branches, Team, commission – (the record is Overview and Logs) |
| Master Partners (RP Ops' page) | V; Documents and Commission – (Overview, RPs, Logs) |
| Institution partners | V, Documents V; Commission – |
| Universities | List V (no Update QS ranking, no Add a university); record E; Scholarships E; **Territory V**; Submission and contacts E |
| Courses | List and record V; **Academic E, English E** |
| Announcements | E |

- **The view-only line** on the pages it only looks at: "View only: Global Ops can look at this page, not change it."
- **Code:** `src/globalops` (portal, model, user, My work); `VIEW` lists the view-only pages, `HIDE` and `SHOW` what's left out and what's re-opened for editing (`course.academic`, `course.english`) inside a view-only page; a section that's view only inside an editable record (Territory) sits in `<ViewOnlyProvider on>`.

### 8.9 GSP · Recruitment

**Menu:** Home (RP Ops' queue of partners), My work, Students, Applications, Course search, Recruitment partners, Master Partners, Institution partners. From Nesil's access sheet (E edit, V view, – not shown):

| Page | Access |
| --- | --- |
| My work (`src/recruitment/work`: the Recruitment queue) | E |
| Mail (Inbox) | – (no Inbox in the menu) |
| Course search | E; commission – |
| Students (list, record, documents) | V |
| Applications | List and record V; **Chat E**; Documents V; **Commission V** (the Commission tab, without Edit); Mail and Submission – |
| Recruitment partners (RP Ops' page) | List and record E; **Branches E, Team E**; Documents and agreements V; **Commission V** |
| Master Partners | V, Documents and Commission V |
| Institution partners | V, Documents and Commission V |
| Universities, Courses, Announcements | – |

- **The view-only line:** "View only: Recruitment can look at this page, not change it" (on Applications: ", except an application's chat").
- **Commission, editable or not:** the Commission tabs are view only unless a role opens them: Finance shows `app.commission`, `rp.commission` and `mp.commission.edit`; Recruitment shows the tabs and keeps them view only (`app.commission.view`, `rp.commission.view`).

### 8.10 GSP · Institution Ops

**Menu:** Home, Inbox, My work, Course search, Institution partners, Universities, Courses, Announcements. From Nesil's access sheet (E edit, V view, – not shown):

| Page | Access |
| --- | --- |
| My work (`src/instops/work`: the Institution Ops queue), Mail | E |
| Course search | E; commission –; with Students and Applications –, **no student picker, Shortlist or Apply** |
| Students, Applications, Recruitment partners, Master Partners | – |
| Institution partners | V (Documents and Commission too) |
| Universities (Update QS ranking, Scholarships, Territory, Submission and contacts), Courses (Academic, English), Announcements | E |

- A link to a page it doesn't have (a notification about an application) opens Home.
- **Code:** `src/instops`; `courses.students` hides Course search's student, shortlist and Apply.

### 8.11 How roles share code

- GSP · Admin and GSP · RP Ops use GSP · Institution's pages (Students, Applications, Course search, Universities…). GSP · View Only is GSP · Institution's portal with `viewOnly` on. GSP · Finance (`src/finance`) GSP · Global Ops (`src/globalops`), GSP · Recruitment (`src/recruitment`) and GSP · Institution Ops (`src/instops`) use GSP · Institution's and RP Ops' pages with access set per page.
- When a role needs a page to differ, it gets **its own copy** in its folder, and the original stays as it was. Examples: RP Ops' Recruitment partners, and each role's My work.
- **CSS is global, so prefix class names per area:**
  - `i*`: Institution;
  - `g*`: Admissions;
  - `ops-`: RP Ops;
  - `cfg__`, `wk-`, `mw-`, `fx__`, `lc__`, `lg__`: Admin;
  - `gw-`, `iw-`, `rw-`: the My work copies.

---

## 9. Accessibility

- **Focus:** `:focus-visible` is a 2 px `--focus` outline, offset 2, radius 6. Inputs show focus with a `--focus` border plus `--input-glow`. **Never remove focus styles.**
- **Skip link** to `#main`. The page's main area is focused on navigation.
- **Visually hidden text:** use `.vh` for labels that are only for screen readers, such as "(required)", "Tick {task}", "Unread:" or "Actions" column headers.
- **Target sizes:**
  - buttons 44 (small 36);
  - inputs 48 (44 in toolbars);
  - icon buttons 32, with a 44 tap area;
  - nav items 42;
  - tab-bar tabs 56;
  - the switch's tap area 44 × 32.
- **Contrast:**
  - text tokens are tuned (`--text-3` is 5.9:1);
  - control borders meet 3:1 (`--line-input`);
  - glass swaps in `--text-3-glass`;
  - small red text uses `--brand-red-text`.
- **Colour is never the only signal:** every owner and status colour carries a word.
- **ARIA:**

  | Component | Pattern |
  | --- | --- |
  | Pop-ups | `dialog` + `aria-modal`, focus trap, focus returns to the opener |
  | Confirmations | `alertdialog`, Cancel focused first |
  | Tabs | `tablist`, roving tabindex |
  | Nav | `aria-current="page"` |
  | Chips, tiles | `aria-pressed` |
  | Pager | `nav` + `role="status"` |
  | Toast | `aria-live="polite"` |
  | Dropdowns | ARIA 1.2 combobox / listbox |
  | Menus | `menu` / `menuitem` |
  | Switch | `role="switch"` |
  | Field errors | `role="alert"`, linked by `aria-describedby` |

- **Motion:** respects `prefers-reduced-motion` (section 2.12).
- **Glass:** respects `prefers-reduced-transparency` and `prefers-contrast: more` (section 2.14).
- **Phones:** inputs are 16 px so iOS doesn't zoom, and safe-area insets are used in the frame and the bottom sheets.

---

## 10. Light and dark

- Every screen works in both. **Light is the default.** There's no "match my device" mode, and the choice is stored in `gsp-theme`.
- Dark values sit under `:root[data-theme="dark"]` in `tokens.css`. **Use tokens, and dark mode follows for free.** Never write a colour in a component.
- **Every dark value is listed beside its light value** in the colour tables: neutrals and brand (2.3), owner colours (2.4), status (2.5), AI (2.6), and shadows (2.10). Glass has its own dark tint (2.14).
- **What changes in dark mode:**
  - the primary colour turns light blue, so **primary buttons invert** (light button, dark text);
  - owner and status backgrounds become translucent tints, and their text gets lighter;
  - shadows turn black and stronger.
- **What stays light in both themes:** document "paper" previews stay white.
- **Check every screen in both themes** before it's done.

---

## 11. Prototype-only: don't build

- **`src/proto/`:**
  - the **Role** and **Prototype** buttons at the bottom right;
  - review states, the theme and device switches, and reset;
  - **Connect** and **Side by side**;
  - the phone frame (`stage.css`), except the `.app` container rule, which the product needs.
- **Review presets** (`*/presets.ts`) and hash links (`#portal-verified`…) in `App.tsx`; `data/testing.ts`.
- **The "Prototype: the RP uploads the signed copy" button** in RP Ops' Recruitment partners.
- **Sample data** in `src/data/` and each role's `data/` folders. People's names in GSP · Admin come from the PM's staff list.
- **State:** it's held in memory and resets on reload. Only these are kept in `localStorage`: the role, the theme, Connect, and the registration draft.
- **Watch for leaks into the product:** two prototype styles are used by product screens (section 12, D10).

---

## 12. Known gaps to resolve

These were found while writing this page. Fix them while building, following this page.

| # | What's wrong | The fix |
| --- | --- | --- |
| D1 | **Two copies of shared helpers:** `Pager` / `usePaged` / `useAsk` are in both `institution/records/parts.tsx` and `admin/config/parts.tsx`; `MultiPick` is in `components/` and `institution/records/` | Build one of each, in the shared components |
| D2 | **My work is built four times** (`admin/config/MyWork.tsx`, `gsp/work`, `institution/work`, `rpops/work`), and its heads differ from the standard: `-0.01em` tracking with a `--t-body` lead | Build one component, configured per role (its views, queue, record column and text case), using `PageHead` (`-0.022em`, `--t-subtitle` lead) |
| D3 | **`--sp-14`** is used through a fallback but isn't a token | Add `--sp-14: 14px` to `tokens.css` |
| D4 | **Motion durations** in JS are hard-coded (0.18 to 0.32 s, and more), not taken from `--dur-*` | Map them to tokens (section 2.12) |
| D5 | **`--shell-top: 64px`**, but the top strip is 68 px | Set it to 68 px |
| D6 | **Some `@media` rules** follow the window, not the app container | Move them to `@container app` |
| D7 | **`rpops/records/Confirm.tsx`** is a separate confirmation, without the close icon | Use `ConfirmDialog` |
| D8 | **No shared Textarea or Radio** component | Add both, matching `TextInput` and `Checkbox` |
| D9 | **Stacked pop-ups** share the id `sheet-title` | Give each pop-up a unique id |
| D10 | **Prototype styles leak:** `.proto__close` is used by the product chat; the phone toast sits at `bottom: 150px` to clear the prototype buttons | Give the chat a product class; lower the toast (section 11) |
| D11 | **Stale comments:** `tokens.css` and `applications.css` call the AI colour "teal" | Correct them: it's the magenta-to-cyan gradient |

---

*Last updated 5 Nov 2026. Keep this page in step with `tokens.css` and the components (see "Keeping this page current" at the top).*
