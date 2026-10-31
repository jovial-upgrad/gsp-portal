import { useEffect, useRef, type ReactNode } from 'react';
import { BrandLockup } from '../components/BrandLockup';
import { GlassRim } from '../components/GlassRim';
import './shell.css';

/**
 * The portal frame. Wide screens: a floating glass sidebar beside the page. Phones: a glass top bar and a
 * floating glass tab bar, with the page scrolling under both. Glass is only the navigation layer; the page's
 * content sits on solid cards. The frame is the same in every account state; only what's inside changes.
 */
export function AppShell({
  sidebar,
  footer,
  tools,
  topEnd,
  corner,
  tabbar,
  inert = false,
  brand,
  children,
}: {
  sidebar: ReactNode;
  footer?: ReactNode;
  /** Small controls (theme toggle, sign out) in the sidebar footer. */
  tools?: ReactNode;
  /** The right end of the phone top bar. */
  topEnd?: ReactNode;
  /** Wide screens: a strip at the top of the page, with this at its right (the notification buttons); the page scrolls under it, not behind it. */
  corner?: ReactNode;
  /** Phone navigation, pinned to the bottom of the screen. */
  tabbar?: ReactNode;
  /** While a sheet is open, the page behind can't be reached. */
  inert?: boolean;
  /** The words beside the logo, on two lines; "Partner Portal" unless set (GSP Team sets its own). */
  brand?: [string, string];
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.inert = inert;
  }, [inert]);

  return (
    <div className="shell" ref={ref}>
      <a className="skip" href="#main">
        Skip to main content
      </a>
      {/* soft light behind the sidebar, for its glass to bend and blur */}
      <div className="shell__glow" aria-hidden="true" />
      <aside className="shell__side glass" aria-label="Portal">
        <GlassRim follow />
        <div className="shell__brand">
          <BrandLockup height={34} label={brand} />
        </div>
        <div className="shell__sidebody">{sidebar}</div>
        {(footer || tools) && (
          <div className="shell__sidefoot">
            {footer}
            {tools && <div className="shell__tools">{tools}</div>}
          </div>
        )}
      </aside>
      <header className="shell__top glass">
        <div className="shell__toprow">
          <BrandLockup height={28} label={brand} />
          {topEnd}
        </div>
      </header>
      <main id="main" className="shell__main" tabIndex={-1}>
        {corner && <div className="shell__corner">{corner}</div>}
        <div className="shell__scroll">{children}</div>
      </main>
      {tabbar}
    </div>
  );
}
