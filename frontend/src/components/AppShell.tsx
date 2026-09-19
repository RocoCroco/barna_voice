import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useRemoteControl } from '../navigation/useRemoteControl';

export function AppShell({ children }: { children: ReactNode }) {
  useRemoteControl();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isVoiceSession = location.pathname === '/recommendations';
  const isProfileSelection = location.pathname === '/profiles';

  return (
    <div className={`app-shell ${isHome ? 'app-shell--home' : ''} ${isVoiceSession ? 'app-shell--voice-session' : ''} ${isProfileSelection ? 'app-shell--profiles' : ''}`}>
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
