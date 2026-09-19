import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRemoteControl } from '../navigation/useRemoteControl';
import { useProfileStore } from '../store/profile.store';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Browse', end: false },
  { to: '/watchlist', label: 'My list', end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  useRemoteControl();
  const location = useLocation();
  const activeProfile = useProfileStore((state) => state.activeProfile);
  const isHome = location.pathname === '/';
  const isVoiceSession = location.pathname === '/recommendations';
  const isProfileSelection = location.pathname === '/profiles';
  const isImmersive = isHome || isVoiceSession || isProfileSelection;

  return (
    <div className={`app-shell ${isHome ? 'app-shell--home' : ''} ${isVoiceSession ? 'app-shell--voice-session' : ''} ${isProfileSelection ? 'app-shell--profiles' : ''}`}>
      {!isImmersive && <header className="topbar">
        <NavLink
          to="/"
          className="brand"
          data-focusable="true"
          aria-label="Compass home"
        >
          <img className="brand__logo" src="/brand/logo.svg" alt="Compass" />
        </NavLink>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-focusable="true"
              className={({ isActive }) =>
                `main-nav__link ${isActive ? 'main-nav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="household-pill" aria-label="Household context active">
          <span className="household-pill__dot" />
          {activeProfile?.name ?? 'Living room'}
        </div>
      </header>}

      <main>{children}</main>

      <footer className="remote-help" aria-label="Remote control shortcuts">
        <span><kbd>↑ ↓ ← →</kbd> Move</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Back</span>
        <span><kbd>V</kbd> Voice</span>
      </footer>
    </div>
  );
}
