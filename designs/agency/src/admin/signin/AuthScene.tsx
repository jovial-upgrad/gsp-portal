import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrandLockup } from '../../components/BrandLockup';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GlassRim } from '../../components/GlassRim';
import photoStudent from '../../assets/signin-student.webp';
import photoStudentTiny from '../../assets/signin-student-tiny.webp';
import photoWorld from '../../assets/signin-world.webp';
import photoWorldTiny from '../../assets/signin-world-tiny.webp';
import '../../shell/auth-scene.css';

const ease = [0.2, 0.8, 0.2, 1] as const;
export const settle = [0.16, 1, 0.3, 1] as const;
const RINGS = [96, 176, 256, 336, 416, 496, 576];
/** How long the glass takes to change shape between sign in and registration (matches the CSS transition). */
const MORPH_MS = 560;

/**
 * The photos behind sign in, taking turns, each with its crop for a wide screen, beside the wider registration
 * panel, and in the band on phones. The landmarks panorama is extended with sky above and water below (to 9:20),
 * so centred, all of it shows at every size; the student keeps clear of the statement.
 */
const SLIDES = [
  { id: 'world', src: photoWorld, tiny: photoWorldTiny, label: 'Landmarks of Paris, London, New York and Pisa along one waterfront', pos: '50% 50%', wide: '50% 50%', narrow: '50% 50%' },
  { id: 'student', src: photoStudent, tiny: photoStudentTiny, label: 'A student smiling in Paris', pos: '78% 42%', wide: '56% 42%', narrow: '80% 30%' },
];

type Scene = { narrow: boolean; ready: boolean; reduce: boolean };
const SceneContext = createContext<Scene>({ narrow: false, ready: true, reduce: false });
/** For content inside the scene: narrow layout, whether the load moment has started, reduced motion. */
export const useScene = () => useContext(SceneContext);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(1200);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * The GSP Admin's copy of the sign-in scene (29 Oct): "GSP Admin" beside the logo. RP Admin's and
 * GSP Team's stay in src/shell.
 *
 * The scene sign in and registration share: the photo (content layer) and one glass panel (control layer).
 * It stays mounted between the two, so switching keeps the photo and brand in place: the old content leaves,
 * the glass changes width, then the new content arrives. `sceneKey` names what's showing; a `heroKey` shared by
 * two scenes keeps what's on the photo in place between them.
 */
export function AuthScene({
  sceneKey,
  wide = false,
  hero,
  heroKey,
  bar,
  children,
}: {
  sceneKey: string;
  wide?: boolean;
  hero: ReactNode;
  heroKey?: string;
  bar?: ReactNode;
  children: ReactNode;
}) {
  const reduce = !!useReducedMotion();
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const narrow = width <= 900;

  // The load moment waits until the photo is decoded, so the content is there before the glass floats over it.
  const photoRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const img = photoRef.current;
    if (!img || ready) return;
    let alive = true;
    const go = () => alive && setReady(true);
    img.decode().then(go, go);
    const t = window.setTimeout(go, 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [ready]);
  const live = ready || reduce;
  const when = <T,>(target: T) => (live ? target : undefined);
  // the photo showing; the dot's fill runs for its turn, and when it ends the next photo fades in
  const [slide, setSlide] = useState(0);
  const next = () => setSlide((i) => (i + 1) % SLIDES.length);

  // Content hands over in three beats: the old content leaves, the glass changes shape, the new content arrives.
  const [shownKey, setShownKey] = useState(sceneKey);
  useEffect(() => {
    if (shownKey === sceneKey) return;
    const t = window.setTimeout(() => setShownKey(sceneKey), reduce || narrow ? 0 : MORPH_MS - 140);
    return () => window.clearTimeout(t);
  }, [sceneKey, shownKey, reduce, narrow]);
  const current = shownKey === sceneKey;

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: 0.22, ease },
  };

  return (
    <SceneContext.Provider value={{ narrow, ready: live, reduce }}>
      <div ref={rootRef} className={`auth ${narrow ? 'auth--narrow' : ''} ${wide ? 'auth--wide' : ''}`}>
        <div className="auth__media" aria-hidden="true">
          {SLIDES.map((sl, i) => (
            <div key={sl.id} className={`auth__slide ${i === slide ? 'is-on' : ''}`} style={{ '--pos': sl.pos, '--pos-wide': sl.wide, '--pos-narrow': sl.narrow } as CSSProperties}>
              <motion.img className="auth__ext" src={sl.tiny} alt="" initial={reduce ? false : { opacity: 0 }} animate={when({ opacity: 1 })} transition={{ duration: 0.8 }} />
              <motion.img
                ref={i === 0 ? photoRef : undefined}
                className="auth__photo"
                src={sl.src}
                alt=""
                decoding="async"
                initial={reduce ? false : { opacity: 0, scale: 1.04 }}
                animate={when({ opacity: 1, scale: 1 })}
                transition={{ opacity: { duration: 0.6 }, scale: { duration: 1.2, ease: settle } }}
              />
            </div>
          ))}
          <div className="auth__scrim" />
        </div>

        <section className="auth__hero" aria-label="upGrad Global Study Partners">
          <motion.a
            href="https://upgradgsp.com/"
            target="_blank"
            rel="noreferrer"
            className="brandpill glass"
            aria-label="upGrad GSP website (opens in a new tab)"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={when({ opacity: 1, y: 0 })}
            transition={{ duration: 0.6, ease, delay: 0.35 }}
          >
            <GlassRim />
            <BrandLockup height={narrow ? 26 : 30} label={['GSP', 'Admin']} />
          </motion.a>
          {narrow && <ThemeToggle glass className="auth__toggle-photo" />}
          <div className="auth__hero-body">
            <AnimatePresence mode="wait">
              {(current || !!heroKey) && (
                <motion.div key={heroKey ?? sceneKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {hero}
                </motion.div>
              )}
            </AnimatePresence>
            {/* which photo is showing: the current one is a bar that fills for its turn; hovering or focusing the dots pauses it */}
            <motion.div
              className="auth__dots"
              role="group"
              aria-label="Photos"
              initial={reduce ? false : { opacity: 0 }}
              animate={when({ opacity: 1 })}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              {SLIDES.map((sl, i) => (
                <button key={sl.id} type="button" className={`auth__dot ${i === slide ? 'is-on' : ''}`} aria-label={`Photo ${i + 1} of ${SLIDES.length}: ${sl.label}`} aria-current={i === slide || undefined} onClick={() => setSlide(i)}>
                  {i === slide && live && !reduce && <span key={slide} className="auth__dot-fill" onAnimationEnd={next} />}
                </button>
              ))}
            </motion.div>
          </div>
        </section>

        <motion.section
          className="auth__panel glass"
          initial={reduce ? false : narrow ? { opacity: 0, y: 40 } : { opacity: 0, x: 32 }}
          animate={when({ opacity: 1, x: 0, y: 0 })}
          transition={{ duration: 0.8, ease: settle, delay: 0.15 }}
        >
          <GlassRim follow={!narrow} />
          <svg className="auth__rings" viewBox="0 0 640 640" aria-hidden="true">
            {RINGS.map((r, i) => (
              <motion.circle
                key={r}
                cx="640"
                cy="0"
                r={r}
                initial={reduce ? false : { opacity: 0, scale: 0.86 }}
                animate={when({ opacity: 1, scale: 1 })}
                transition={{ duration: 1.1, ease: settle, delay: 0.35 + i * 0.07 }}
              />
            ))}
          </svg>
          {(!narrow || bar) && (
            <div className="auth__bar">
              <AnimatePresence mode="wait">
                {current && bar && (
                  <motion.div key={sceneKey} className="auth__bar-left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {bar}
                  </motion.div>
                )}
              </AnimatePresence>
              {!narrow && <ThemeToggle />}
            </div>
          )}
          <main id="main" className="auth__center" tabIndex={-1}>
            <AnimatePresence mode="wait">
              {current && (
                <motion.div key={sceneKey} className="auth__view" {...swap}>
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
          <footer className="auth__foot">
            <span>© 2026 upGrad Global Study Partners</span>
            <nav className="auth__legal" aria-label="Legal">
              <a href="#privacy" onClick={(e) => e.preventDefault()}>
                Privacy
              </a>
              <a href="#terms" onClick={(e) => e.preventDefault()}>
                Terms
              </a>
            </nav>
          </footer>
        </motion.section>
      </div>
    </SceneContext.Provider>
  );
}
