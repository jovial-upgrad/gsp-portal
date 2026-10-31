# Animation Principles & Effect Categories

## Three disciplines — know which one you're in

| Discipline | What it is | Tools | Where it lives |
|---|---|---|---|
| **UI animation** | State/transition feedback inside a product interface | Motion, GSAP, CSS, Figma Smart Animate, ProtoPie | Dashboards, apps, LMS/CMS, forms |
| **Motion graphics** | Illustrated/brand animation for communication | After Effects → Lottie or Rive | Onboarding, empty states, explainers, marketing |
| **3D/WebGL** | Real-time rendered 3D scenes and shader effects | Three.js/R3F, Spline, GLSL/WGSL | Heroes, configurators, immersive marketing sites |

Mixing these up is the most common briefing mistake — e.g. asking a UI-animation dev to build a WebGL hero, or over-speccing After-Effects-style motion graphics into a data-heavy dashboard where it'll hurt usability.

## Why animation earns its place (the purpose test)

Before adding any motion, it should be doing one of these jobs:
- **Feedback** — confirms an action happened (button press, form error shake)
- **Continuity/spatial orientation** — connects states so users don't lose their place (thumbnail → detail view)
- **Hierarchy & attention** — staggering/choreography directs the eye
- **Perceived performance** — skeleton screens/loaders make waits feel shorter
- **Delight & storytelling** — brand personality (highest risk of overuse — use sparingly)

If a proposed animation doesn't map to one of these, question whether it should exist at all — this is the single biggest thing separating restrained, premium-feeling products (Linear, Stripe, Vercel) from generic ones.

## Timing & easing — the core craft

- **Duration:** ~100–400ms for most UI transitions. Nielsen Norman Group: 400ms is already "very slow"; past ~500ms it "starts to feel like a real drag." Material Design: ~200–300ms mobile, ~150–200ms web/desktop.
- **Easing:** never linear — linear motion reads as unnatural because almost nothing in the physical world moves that way.
  - **Ease-out** for elements entering the frame
  - **Ease-in** for elements exiting
  - **Ease-in-out** for movement within the frame
- **Anticipation, overshoot/spring, staggering, choreography** — borrowed from Disney's 12 principles, adapted for screens. Adding proper ease is "the fastest way to make beginner animation look professional."
- Emil Kowalski (Linear) / Stripe's engineering-led approach: subtle, fast, purposeful. Animate `transform`/`opacity` only; keep the main thread free; prize perceived smoothness and determinism over visual fidelity.

## The 13 effect categories

1. **Micro-interactions** — button/toggle/input feedback, hover states
2. **Transitions & page transitions** — route changes, shared-element transitions
3. **Scroll-triggered animation** — reveals, pinning, scrubbing tied to scroll position
4. **Parallax** — layered depth on scroll or pointer movement
5. **Cursor-follow / custom cursors** — magnetic buttons, blob/trail cursors
6. **Grid/list animations** — staggered entrance, layout/FLIP transitions
7. **Slider/carousel animation** — momentum, snapping
8. **Text effects** — split-text reveals, kinetic typography
9. **Physics-based** — spring, inertia, drag, gravity
10. **Loading/skeleton** — spinners, shimmer, progress
11. **SVG path animation** — drawing, morphing
12. **Navigation/menu animation** — expand/collapse, mega-menu choreography
13. **Generative/particle & WebGL effects** — distortion, fluid, noise fields, atmosphere

Each maps to a specific tool set — see `library-catalog.md`.

## Motion graphics specifics (Lottie vs Rive)

- **Lottie** (JSON, via Bodymovin from After Effects) — plays back like a video (play/pause/reverse/scrub). Best for loops, onboarding, icons, empty states. Free/paid library at LottieFiles.
- **Rive** (`.riv`) — has real **state machines**: define states (idle/hover/loading/success/error) and drive transitions from live app data/user input, no per-frame code. Best when the animation is part of UX *logic*, not just playback.
- Rule of thumb: static/looping decoration → Lottie. Animation that must react to real app state → Rive.

## Accessibility & performance rules (apply always)

- Animate only GPU-composited properties: `transform`, `opacity`. Never animate `width`/`height`/`top`/`left` (triggers layout reflow).
- Target 60fps (16.7ms/frame budget).
- Respect `prefers-reduced-motion` — reduce/replace large motion (parallax, big slides) with fades or shortened durations, don't just kill everything; keep near-zero (not exactly 0) durations so state machines/`transitionend` still fire.
- Use `will-change` sparingly — it promotes an element to its own GPU layer but overuse wastes memory.
- Mobile WebGL: cap device-pixel-ratio, reduce poly count/shader complexity, provide static/image fallback.
