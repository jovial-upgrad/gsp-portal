---
name: gsp-design
description: 'The GSP Design skill. Consult it first whenever designing, building, mocking up, prototyping, critiquing or reviewing anything for upGrad GSP or GSP 3.0 (Global Study Partners): the agency (recruitment partner) portal, GSP team screens (Admissions queues, BAP, IP team, Data team, Finance, recruitment managers, Super admin, Leadership), dashboards, course search, applications, students, documents, commission and earnings, onboarding, the Ask GSP assistant, or any component, flow, layout or visual style for them. Use it even when the request just says "design the home screen", "build a dashboard", "redesign this" or names a GSP screen without saying GSP. It bundles 48 GSP design references, 72 visual-library references, GSP product rules, a screen-to-reference map, AI feature patterns, 2026 trends and hierarchy psychology. It includes the visual-library skill, so use it for general UI and UX design work too.'
---

# GSP Design

This skill is the starting point for any GSP design work. It holds two reference libraries, the GSP product rules that every screen must respect, and the research behind good visual decisions. Start here every time; then design freely.

**It is a reference, not a cage.** Pick up components, layouts, structures, styles and visual ideas from it first, then think beyond it. If a better pattern serves the user, use it and say why. What's fixed are the GSP product rules in `references/gsp-product-context.md`; everything visual is a starting point.

## What's inside

| Library | What it is | Where |
| --- | --- | --- |
| **GSP references (48)** | Design inspirations gathered for GSP 3.0: a study-abroad platform (applyr), finance and lending dashboards, CRM records and queues, AI assistants, document handling, health dashboards, expressive data-viz | `assets/gsp-references/`, described in `references/gsp-reference-manifest.md`, synthesised in `references/gsp-reference-analysis.md` |
| **Visual library (72)** | A broader research-grounded set: fintech, SaaS, CRM, logistics, edtech and LMS landing pages, an upGrad programme page, health, AI-native products | `assets/visual-library-references/`, described in `references/visual-library-manifest.md`, synthesised in `references/visual-library-analysis.md` |
| **GSP product context** | The business, roles, journeys, 8 stages, design rules, audit findings, competitor learnings, vocabulary, scale | `references/gsp-product-context.md` |
| **Screen-to-reference map** | For every GSP screen: its job, which images to open, which patterns to start from | `references/screen-to-reference-map.md` |
| **Research layer** | Which inspiration library for which job; proven vs hyped 2026 trends; AI feature patterns and "AI slop" tells; visual hierarchy and Laws of UX | `references/inspiration-libraries.md`, `references/trends-2026.md`, `references/ai-feature-patterns.md`, `references/visual-hierarchy-and-psychology.md` |

## How to work with it

1. **Read the GSP rules first** (`references/gsp-product-context.md`) when the work is for GSP. They decide what a screen must say and do: who has it (amber agency, violet GSP, blue university), what to do now, minimal agency screens, no jargon, a frame that never changes with state, chat as a first-class surface.
2. **Find the screen in `references/screen-to-reference-map.md`.** It names the job of the screen and the references to open first. For anything not listed, search `gsp-reference-manifest.md` and `visual-library-manifest.md` by pattern (stage path, list + detail, deadline card, match card, AI panel, folder, success sheet…).
3. **Look at the actual images.** Open the named files with `view` (e.g. `assets/gsp-references/gsp-35-dynamics-sales-hub-my-work.webp`). The descriptions help you choose; the picture is the reference. Open two or three, not twenty.
4. **Pick what to take, and from where.** Use the component table in `references/gsp-reference-analysis.md` (section 6) to borrow specific components, and its colour, typography and chart sections for style. Prefer the GSP set for GSP screens; use the visual library for breadth, landing pages, edtech and AI precedents.
5. **State the direction before building.** In a line or two, name what you're drawing on and what you're changing ("Application page: process bar and Up Next from Dynamics (G-35), fact strip from Salesforce Billing (G-33), owner colours from the brief; denser table than the reference"). This gives the person something to react to.
6. **Then design beyond the references.** Combine patterns, simplify them, or invent where none fits. Check the result against the GSP rules, the "What not to copy" list in `gsp-reference-analysis.md` section 11, and the AI guidance in `ai-feature-patterns.md`.
7. **Use companion skills where available:** `upgrad-design-system` for upGrad brand tokens, type and components; `frontend-design` for building UI in code; `animation-library-by-nesil` for motion; the `ux-writing` and `ux-copy` skills for wording; accessibility review skills before handoff.

## Quick reference: the GSP visual direction from the references

- **Overall:** calm, light, premium SaaS. Off-white page, white rounded cards (16–24 px radius), near-black text, black or navy primary buttons, generous space, one accent colour, soft separation by tint rather than heavy shadows.
- **Navigation:** left sidebar with grouped section labels and a filled pill for the active item (applyr G-06/14/16); or centred pill nav with an icon rail. Tabs with count badges and segmented controls inside pages.
- **Structure:** greeting + one-line summary → one hero number or action card → bento grid of cards → list or table. Records: big name → fact strip → stage path → fixed tabs → side column (score, chat, team). Queues: list + detail with the selected row inverted.
- **Numbers as display type:** the biggest text on a screen is a number, with greyed decimals or units ("AUD 12,810", "24/38", "2 days").
- **Status:** semantic pills with a dot or icon (green done, amber pending, red blocked, grey draft); for GSP, owner colours amber / violet / blue always with words.
- **Signature components for GSP:** action-required card (G-18), stage path + Up Next (G-33, G-35), match card with "why this matches" (G-06), verdict ring with a word label (G-44), profile completion with the missing items (G-16), deadline card with countdown and one action (G-16, G-21), duplicate panel with Smart Merge (G-45), list + detail (G-40), folder cards and Auto upload (G-02, G-07), success sheet with thumbnails (G-47), three-way money split and banded tier scale (G-13, G-01), AI panel with suggested prompts (G-29).
- **Charts:** single stacked bar for pipelines, bars with one highlighted value and a limit line, rings with word labels, Sankey only for leadership funnels, hatching for pending or projected.
- **AI:** a labelled, distinct surface (glass panel or card) with suggested prompts, a visible working state, reasons with every score, and a human handover. Avoid the generic indigo-violet gradient plus bare sparkle.

## Quick reference: the research layer (from the visual library)

- **Where to look:** shipped patterns on Mobbin, SaaSUI, Page Flows, SaaS Interface; craft on Awwwards, Godly; landing pages on Saaspo, Land-book; components on Collect UI, UI Movement; Dribbble and Behance for direction only. Full guide: `references/inspiration-libraries.md`.
- **Proven in 2026:** bento grids, token-based dark mode, design systems as the foundation. Occasional only: glassmorphism (nav, modals, AI panel), kinetic type. Underdelivered: 3D/WebGL heroes, heavy AI personalisation. Full detail: `references/trends-2026.md`.
- **AI features:** copilot, not autopilot; show the plan before acting; confidence signalling; progressive delegation; always an undo; label AI and give it its own colour. Full detail: `references/ai-feature-patterns.md`.
- **Hierarchy:** size, then contrast, whitespace, alignment, colour last; if it reads in greyscale the hierarchy is right. Laws most used: Hick, Fitts, Miller, Zeigarnik (progress and checklists), Doherty (respond under ~400 ms or show progress), Von Restorff (one standout action), Peak-End (design the success moment). Full detail: `references/visual-hierarchy-and-psychology.md`.

## Things to keep in mind

- Many references are Dribbble-style concepts in device mockups. Take their structure and moments; don't copy their low-contrast grey-on-white text, decorative charts, glass everywhere or one-row emptiness. GSP screens carry hundreds of rows and are used all day.
- The visual-library files were written for a different product (an LMS called Prism) in places; read "Prism" as "the product being designed" and apply the reasoning to GSP.
- Duplicates across the two sets: G-01 = VL-2, G-18 = VL-15; several others are siblings (listed at the end of `gsp-reference-manifest.md`).

## Reference files

- `references/gsp-product-context.md` — GSP business, roles, journeys, stages, design rules, audit and competitor learnings, vocabulary, scale
- `references/screen-to-reference-map.md` — every GSP screen mapped to references and starting patterns
- `references/gsp-reference-manifest.md` — what each of the 48 GSP images shows, what to take, which screen it helps
- `references/gsp-reference-analysis.md` — the GSP set synthesised: layout, navigation, colour, type, components, charts, AI, documents, imagery, what not to copy, translation to GSP
- `references/visual-library-manifest.md` — what each of the 72 visual-library images shows
- `references/visual-library-analysis.md` — the 72-image set synthesised
- `references/inspiration-libraries.md` — which design library for which job
- `references/trends-2026.md` — proven vs hyped 2026 trends
- `references/ai-feature-patterns.md` — representing AI well, and the tells to avoid
- `references/visual-hierarchy-and-psychology.md` — hierarchy levers, Laws of UX, heuristics, learning psychology
- `assets/gsp-references/` — the 48 GSP images (`gsp-NN-short-description.webp`)
- `assets/visual-library-references/` — the 72 visual-library images
