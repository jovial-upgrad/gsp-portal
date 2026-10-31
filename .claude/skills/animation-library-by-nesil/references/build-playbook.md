# Build Playbook

## Recommended default stack

```
React / Next.js (base)
  → Motion (Framer Motion)        — UI micro-interactions, route transitions, layout animation
  → GSAP + ScrollTrigger + Lenis  — scroll storytelling, timeline-heavy marketing sequences
  → Lottie / Rive                 — motion-graphics assets (onboarding, branded loaders, state-driven icons)
  → Spline                        — designer-built 3D scenes, fast embeds
  → Three.js / R3F + Rapier       — bespoke WebGL, shaders, product configurators, real 3D physics (specialist-led)
```

**Decision rule:** reach for the lightest tool that gets the intended feel. CSS/Motion first → GSAP when the sequence gets complex or scroll-driven → full Three.js/WebGL only when the effect genuinely requires 3D or a shader (distortion, particles, real depth). Most "premium feel" requests are solved by disciplined timing/easing, not by adding 3D.

## How to build each effect category

| Category | Conceptual approach | Tool |
|---|---|---|
| **Scroll-triggered** | Bind animation progress to scroll position via `ScrollTrigger` (pin, scrub, or trigger-based reveal) | GSAP + ScrollTrigger, wrapped in Lenis for smooth native scroll |
| **Parallax** | Move layers at different speeds relative to scroll/pointer, using `transform: translateY/translateX` only | ScrollTrigger's built-in parallax helpers, or manual `transform` binding |
| **Cursor-follow / magnetic buttons** | Track pointer offset relative to element's bounding box; lerp toward it; snap back with elastic ease on leave | GSAP `quickTo()` (no dedicated library needed) |
| **Grid/list animation** | Stagger entrance timing across children; use FLIP technique for layout-position changes | GSAP `stagger`, Motion `layout` prop |
| **Sliders/carousels** | Momentum + snap-point physics, touch/drag support | Swiper.js, Splide, or Keen Slider |
| **Page transitions** | Intercept navigation, animate outgoing view out and incoming view in | Barba.js (multi-page sites), Motion `AnimatePresence` (React SPAs) |
| **Text effects** | Split text into lines/words/chars, animate each with stagger | GSAP SplitText or SplitType |
| **Physics** | Spring/inertia for UI feel; full rigid-body simulation for real 3D physics | React Spring/Motion springs (UI); Rapier via `@react-three/rapier` (3D) |
| **Hover effects** | State-based transform/opacity/filter changes, often with spring easing | CSS transitions or Motion `whileHover` |
| **Navigation/menu** | Expand/collapse with height/clip-path animation, staggered menu-item reveal | GSAP timeline or Motion `AnimatePresence` + variants |
| **Loading/skeleton** | Shimmer gradient sweep or branded Lottie/Rive loader | CSS gradient animation, or Lottie for branded loaders |
| **SVG path animation** | Animate `stroke-dashoffset` for draw-on effects, or morph between path `d` attributes | GSAP DrawSVG / MorphSVG |
| **Generative/particle/WebGL** | GPU-driven particle systems, noise fields, fluid/distortion shaders | Three.js/R3F with custom GLSL, or Spline for simpler cases |

## 3D/WebGL conceptual pipeline

1. **Model** in Blender (or source from Poly Haven/Sketchfab for free assets)
2. **Export** as glTF/GLB (compress with Draco via gltf-pipeline for file size)
3. **Import** into Three.js/R3F (`useGLTF` hook, convert with `gltfjsx` to JSX) or directly into Spline
4. **Animate/interact** — swap materials, lerp transforms in R3F's `useFrame`, manage interaction state with Zustand/Valtio

### Shaders — what to know for briefing (not for writing yourself)

- **Vertex shader** — runs once per vertex, positions/transforms geometry ("sets the stage")
- **Fragment (pixel) shader** — runs once per pixel, computes color/texture/lighting ("adds the color")
- **Uniforms** — values passed in from the app that stay constant per draw call (time, mouse position, colors) — this is how you make a shader interactive/reactive
- **GLSL** — the C-like language shaders are written in for WebGL; **WGSL** is the newer equivalent for WebGPU (syntax closer to Rust/TypeScript), adds compute shaders

**How to brief this without knowing GLSL:** describe the *look* (a distortion, a gradient, a noise pattern) and the *interaction inputs* (pointer position, scroll progress, elapsed time) — the developer implements it with uniforms wired to those inputs.

### Product configurator architecture

One glTF model with **named, swappable parts** → load once → **swap materials/colors at runtime** (don't reload the whole model per variant) → hold configuration state in an app store → validate combinations against a backend/product catalog. Build-vs-buy: SaaS platforms (Threekit, Zakeke, Roomle) for small catalogs and fast timelines; custom R3F for multi-year, feature-rich needs.

### Spline vs hand-coded Three.js

**Spline** ("the Figma of 3D") — browser-based, collaborative, no-code, native Webflow/Framer embeds, `@splinetool/react-spline` component. Best for 4-week prototypes and design-led builds.

**Limitations vs code:** larger export/bundle sizes (common reason teams rebuild in Three.js for production), less fine-grained optimization, framework lock-in.

**Rule of thumb:** Spline for prototypes and design-led work; Three.js/R3F for commercial, performance-critical, multi-year builds.

## What separates "premium feel" from generic

Not more effects — restraint + engineering discipline:
- Purposeful, choreographed motion (every animation maps back to the purpose test in `principles-and-categories.md`)
- Buttery 60fps under load, even with CPU throttling
- WebGL used for atmosphere/framing, not spectacle for its own sake
- Strong typographic/art direction underneath the motion
- Performance discipline that still passes Core Web Vitals

**Practical QA test:** open a reference site in DevTools, throttle CPU 4–6×, watch how transitions are sequenced and how performance is protected.

**Studios/agencies worth studying:** Active Theory, Lusion, Resn, Locomotive, darkroom.engineering, Immersive Garden, 14islands, Obys Agency, Bonhomme.

**Typical award-site stack:** Next.js + GSAP/ScrollTrigger + Lenis + R3F/Three.js, often with custom GLSL shaders for distortion/particles.

## How Nesil should personally engage (design-leader level, not developer level)

**Learn hands-on:**
- Figma Smart Animate for flows and magic-move
- ProtoPie for high-fidelity/sensor-driven interaction specs
- Spline for 3D concepting
- Basic GSAP timeline syntax (`gsap.timeline()`, `.to/.from/.fromTo`, `stagger`, basic `ScrollTrigger`) — enough to prototype and read developer code

**Brief well** by specifying: intent (what the motion communicates), duration/easing tokens, trigger (hover/scroll/state), choreography/stagger order, reduced-motion fallback, and a reference clip or link.

**QA against benchmarks:** 60fps in DevTools at 4–6× CPU throttle; only `transform`/`opacity` animating; `prefers-reduced-motion` honored; no layout shift during animation; mobile fallback present.

**Hand off to a specialist:** custom GLSL shaders, R3F/WebGL scenes, physics simulations, heavy scroll-synced WebGL, and performance optimization of the same.

## Learning path (named resources)

- **Emil Kowalski — "Animations on the Web" (animations.dev)** — craft of polished UI motion; CSS transitions/animations + Motion-for-React; ~$199 with periodic discounts. Author is a Linear design engineer.
- **Josh W. Comeau — "Whimsical Animations" (joshwcomeau.com)** — delightful animation with modern CSS + JS + SVG + Canvas + React.
- **Frontend Masters — "Build Immersive Experiences" by Matias Niemelä** (ex-GSAP core engineer) — GSAP + CSS + ScrollTrigger storytelling + GSAP with Three.js/R3F.
- **Bruno Simon — Three.js Journey (threejs-journey.com)** — the definitive Three.js/WebGL course; ~$120; large Discord community.
- **Carl Schooff — Creative Coding Club (creativecodingclub.com)** — largest GSAP training collection (~300 lessons); from ~$2.95/mo.
- **Awwwards Academy** — creative-coding/WebGL/Three.js/shaders/motion courses (~$12/mo Creative Pass).
- **GSAP learning center (gsap.com/resources)** — official docs, "Learn GSAP for Webflow," ScrollTrigger guides.
- **Codrops (tympanus.net)** — the key open-source demo/tutorial resource for exactly these effects (scroll, grid, sliders, transitions, cursor, WebGL/GLSL). Filterable "Creative Hub" by effect type.
- **YouTube:** Yuri Artiukh (akella), Codegrid, Wawa Sensei (R3F/configurators).

## Staged adoption plan (if rolling this out to a design team)

1. **Weeks 1–4:** Establish a motion system — duration/easing tokens, reduced-motion policy, "when to animate" rubric. Standardize on Motion for product UI.
2. **Weeks 2–8:** Build hands-on capability — Figma Smart Animate practice, one designer deep on ProtoPie, one on basic GSAP, add Spline for 3D concepting.
3. **Weeks 6–14:** Ship one flagship page with Next.js + GSAP + Lenis; study 2–3 reference sites in DevTools; bring in a specialist for any WebGL.
4. **Quarter 2+:** Introduce 3D/WebGL selectively — prototype in Spline first; migrate to R3F only if production-critical and performance-bound.
