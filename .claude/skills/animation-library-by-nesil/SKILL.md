---
name: animation-library-by-nesil
description: Nesil's reference library for UI/UX motion, animation, motion graphics, and 3D/WebGL — animation principles, effect categories (scroll, parallax, cursor, grid, sliders, transitions, text, physics, hover, nav), named tools (GSAP, Motion, Lenis, Three.js/R3F, Spline, Rive, Lottie), a vetted audit of sourced sites (ThreeUI, Skiper UI, Animmaster Lib, MotionSites AI, vgpu.sh, Awwwards, Dribbble), and a designer-to-developer build/briefing workflow. ALWAYS use whenever Nesil is designing, prototyping, reviewing, or building anything involving motion, animation, interaction, transitions, micro-interactions, 3D, WebGL, shaders, scroll effects, hover states, sliders, nav menus, loading states, or "premium"/"Awwwards-style" polish — for upGrad, Malayali Kada, Where's Gucci, Household Passbook, the farm, or any other project. Trigger even without the word "animation" — e.g. "make this feel more premium," "add some motion," "how should this transition work," "brief a developer on this interaction," "reference for this."
---

# Animation Library by Nesil

Nesil's standing reference for motion design and animation/3D-WebGL implementation — built from a deep research pass (Sept 2026) plus a vetted audit of specific tools and inspiration sites he sourced himself. Consult this every time motion, animation, or "premium feel" comes up in design or build work, across any of his projects (upGrad, Malayali Kada, Where's Gucci, Household Passbook, the farm).

## How to use this skill

1. **Identify what's actually being asked** using the decision table below — a UI micro-interaction, a marketing scroll story, or a 3D/WebGL build are different problems with different tools.
2. **Pull the right reference file** — don't load everything by default:
   - `references/principles-and-categories.md` — animation theory, timing/easing, the 13 effect categories (scroll, parallax, cursor, grid, sliders, page transitions, text, physics, hover, nav, loading, SVG, generative), motion graphics vs UI animation vs 3D/WebGL.
   - `references/library-catalog.md` — every named tool/library from the research, organized by category, with what each is actually good for and current 2025–26 status (GSAP now free, Framer Motion → Motion, Lenis as scroll standard, Rapier as physics leader, etc.).
   - `references/tool-audit.md` — the specific sites Nesil sourced (ThreeUI, Skiper UI, Animmaster Lib, MotionSites AI, vgpu.sh, Awwwards, Dribbble, LottieFiles) with an honest read on what each actually is, cost, and fit — including caveats on the ones with dark-pattern marketing or cloned-effect sourcing.
   - `references/build-playbook.md` — how to actually build each effect category (conceptual pipeline + which library + what to brief a developer), the premium-site tech stack, performance/accessibility rules, and the learning path.
3. **Default stack recommendation** (unless the task says otherwise): React/Next.js base → Motion (Framer Motion) for UI micro-interactions → GSAP + ScrollTrigger + Lenis for scroll storytelling → Spline for designer-built 3D, R3F/Three.js for bespoke WebGL with a specialist.
4. **Always name the specific library/tool** in the answer — don't describe an effect abstractly when a concrete tool (with the right one from the catalog) makes it buildable today.
5. **When sourcing from Nesil's saved sites**, apply the tool-audit caveats — e.g., flag if a technique traces to Animmaster Lib's "rebuilt from top-tier websites" cloned components before it goes into paid client/product work.

## Quick decision table

| Nesil's ask sounds like... | Category | Reach for |
|---|---|---|
| "hover state," "button feedback," "toggle animation" | Micro-interaction | Motion (Framer Motion) or CSS transitions |
| "scroll reveal," "pin this section," "scrub animation to scroll" | Scroll-triggered | GSAP + ScrollTrigger + Lenis |
| "parallax," "depth on scroll" | Parallax | GSAP ScrollTrigger / Lenis / CSS transforms |
| "cursor follow," "magnetic button," "custom cursor" | Cursor effect | GSAP `quickTo` (hand-built, no dedicated library) |
| "grid animation," "staggered cards/list" | Grid/list | GSAP stagger, Motion `layout` |
| "slider," "carousel" | Slider | Swiper.js, Splide, Keen Slider |
| "page transition," "route change animation" | Page transition | Barba.js (MPA) or Motion `AnimatePresence` (React) |
| "text reveal," "split text," "kinetic typography" | Text effect | GSAP SplitText, SplitType |
| "spring," "bounce," "drag with inertia" | Physics | React Spring / Motion springs (UI); Rapier (true 3D physics) |
| "loading state," "skeleton" | Loading | CSS/Motion shimmer, Lottie for branded loaders |
| "3D hero," "product configurator," "WebGL scene" | 3D/WebGL | Spline (designer-led) or Three.js/R3F (specialist-led) |
| "make it feel premium/Awwwards-y" | Full motion system | See `build-playbook.md` premium-stack section |
| "onboarding animation," "brand explainer" | Motion graphics | Lottie (playback) or Rive (state-driven) |
| "what's a good reference for X" | Inspiration | `tool-audit.md` — pick the right source per the honest-read table |

## Non-negotiable guardrails (apply every time)

- **Performance:** only animate `transform`/`opacity` for anything GPU-bound; target 60fps; call out `prefers-reduced-motion` handling whenever proposing anything beyond a subtle fade.
- **Attribution/IP:** if a technique is sourced from Animmaster Lib (explicitly "rebuilt from top-tier websites") or a Dribbble shot, treat it as inspiration/moodboard only — not as code to ship into a commercial upGrad or MK product without rebuilding it cleanly.
- **Scope the effort honestly:** Spline/no-code for 4-week timelines and prototypes; hand-coded Three.js/R3F only when performance or production longevity justifies a specialist's time.
- **Don't over-recommend WebGL.** Most "premium feel" asks are solved by disciplined easing/timing + GSAP/Motion, not by reaching for 3D. Suggest the lightest tool that achieves the intended feel first.
