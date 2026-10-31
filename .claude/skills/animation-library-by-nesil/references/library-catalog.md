# Library & Tool Catalog

Status as of the Sept 2026 research pass — re-verify pricing/availability before committing, this space moves fast.

## JS/CSS animation libraries

| Library | Best for | Notes |
|---|---|---|
| **GSAP (GreenSock)** | Complex, timeline-heavy sequencing; scroll-driven work | Now 100% free including all former Club plugins (ScrollTrigger, SplitText, MorphSVG, DrawSVG, Draggable, Inertia, ScrollSmoother) as of GSAP v3.13 (April 30, 2025), following Webflow's acquisition of GreenSock. The industry standard for precision. |
| **Motion** (formerly Framer Motion) | React (now also Vue/vanilla) UI enter/exit, layout, gestures | Spun out as independent project — package is now `motion`, import `motion/react`. Declarative: `motion.div`, variants, `AnimatePresence` for exit animations. |
| **anime.js** | Lightweight CSS/SVG/timeline animation | v4 released 2025, concise syntax. |
| **Motion One** | Tiny footprint | Built directly on the Web Animations API. |
| **Popmotion** | Low-level functional primitives | Underpins older Framer Motion internals. |
| **React Spring** | Physics/spring-based React animation | `useSpring`, `useTransition` hooks. |
| **AutoAnimate (FormKit)** | Zero-config list add/remove/move | One-hook drop-in, minimal setup. |
| **Theatre.js** | Visual timeline editor for JS/Three.js | Good when non-devs need to tweak keyframes. |
| **Barba.js** | Page-transition orchestration on MPAs | SPA-like transitions without a full framework rewrite. |

## Scroll-specific

| Library | Best for |
|---|---|
| **GSAP ScrollTrigger** | The most capable scroll engine — pin, scrub, snap |
| **Lenis** (darkroom.engineering, ex-Studio Freight) | The current industry-default smooth-scroll library; keeps native scroll/accessibility; ~5kb; pairs naturally with ScrollTrigger |
| **Locomotive Scroll** | v5 is a rewrite built on top of Lenis |
| **ScrollMagic** | Older scroll library, still used paired with GSAP |
| **AOS (Animate On Scroll)** | Tiny attribute-based reveal library for simple cases |
| **Framer Motion `useScroll`** | Scroll-linked values natively in React, no extra library |

## 3D & WebGL

| Tool | Best for |
|---|---|
| **Three.js** | The dominant WebGL library — foundation for almost everything else here |
| **React Three Fiber (R3F)** + **drei** + **gltfjsx** + **Leva** | React-idiomatic 3D ecosystem (pmndrs) — this is the modern way to do Three.js in a React/Next.js codebase |
| **Babylon.js** | Full-featured alternative engine, has Havok physics built in |
| **PlayCanvas** | Engine + collaborative visual editor |
| **Spline** | Designer-friendly, no-code 3D — "the Figma of 3D," native Webflow/Framer embeds, React component available |
| **OGL** | Lightweight raw WebGL library, for when Three.js is too heavy |
| **TresJS** | Three.js equivalent for Vue |
| **WebGPU / WGSL** | Newer, lower-level graphics API; adds compute shaders. Three.js's TSL compiles once to both GLSL and WGSL |
| **vgpu** (Vercel Labs, open source) | Advanced WebGPU examples — raymarching, fluid sim, FFT ocean, radiance cascades. Graphics-research grade, useful as a specialist's reference bar, not a starting point |

## Physics engines

| Engine | Best for |
|---|---|
| **Rapier** (Rust/WASM, `@react-three/rapier`) | Current 2025–26 performance leader; deterministic; 2D+3D |
| **cannon-es** | Pure JS/TS, beginner-friendly, natural Three.js pairing |
| **Matter.js** | Feature-rich 2D engine with good debug rendering |
| **Ammo.js** | Widest feature set (soft body, cloth) but heaviest bundle |
| **Motion/Framer Motion springs** | Physics *feel* for UI without a full engine |

## Text animation

- **GSAP SplitText** — split into lines/words/chars for reveals; v3.13.0 rewrite is ~50% smaller (~7kb), emoji-safe, accessibility-aware (`aria-label`/`aria-hidden`)
- **SplitType** — standalone splitter, framework-agnostic
- **Typed.js** — typewriter effect

## Cursor effects

No dedicated library is standard here — magnetic buttons and custom cursors are typically hand-built with **GSAP `quickTo`**, tracking pointer offset relative to the element's bounding box with an elastic ease on release.

## No-code / low-code for full sites

| Tool | Best for |
|---|---|
| **Webflow** | Visual builder, full CSS control, CMS/SEO; GSAP is now natively integrated into the Designer canvas (late 2025) |
| **Framer** (website builder) | Design-tool DNA, best-in-class *native* motion (scroll effects, page transitions, 3D transforms); fastest path to a polished animated marketing site without touching code |
| **Spline** | 3D scenes with native embeds into Webflow/Framer/Wix |
| **Rive** | Interactive, state-driven animation for products |

## Design/prototyping tools with strong motion

| Tool | Strength | Limitation |
|---|---|---|
| **Figma Smart Animate** | Everyday default — magic-move tweening between frames | No sensors, no conditional logic, no true physics |
| **ProtoPie** | Deepest interaction fidelity — sensors, hardware, conditional logic, multi-device | Steeper learning curve |
| **Origami Studio** (Meta) | Free patch-graph tool, real logic + native hardware APIs | Mac-only, node-based learning curve |
| **Principle** | Lightweight macOS timeline prototyping | macOS only, lighter feature set |
| **Rive** | Doubles as both prototyping and production tool | Best when animation logic is the point |

## Motion graphics runtimes

- **Lottie-web** — playback runtime for Lottie JSON (via LottieFiles or Bodymovin export from After Effects)
- **Rive runtime** — playback + state machine runtime for `.riv` files
