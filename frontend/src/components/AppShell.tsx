import { MicOff } from 'lucide-react';
import { useLayoutEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useRemoteControl } from '../navigation/useRemoteControl';
import { useProfileStore } from '../store/profile.store';
import { useRecommendationStore } from '../store/recommendation.store';
import { useVoiceStore } from '../store/voice.store';
import { voiceProvider } from '../voice/VoiceProvider';

export function AppShell({ children }: { children: ReactNode }) {
  useRemoteControl();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isVoiceSession = location.pathname === '/recommendations';
  const isProfileSelection = location.pathname === '/profiles';
  const profileId = useProfileStore((state) => state.activeProfile?.id);
  const micMuted = useVoiceStore((state) => state.micMuted);

  useLayoutEffect(() => {
    const session = useRecommendationStore.getState();
    const withinSession = location.pathname === '/recommendations' || location.pathname.startsWith('/content/');
    if (withinSession && (!session.profileId || session.profileId === profileId)) return;
    session.reset();
    useVoiceStore.getState().reset();
    void voiceProvider.disconnect();
  }, [location.pathname, profileId]);

  return (
    <div className={`app-shell ${isHome ? 'app-shell--home' : ''} ${isVoiceSession ? 'app-shell--voice-session' : ''} ${isProfileSelection ? 'app-shell--profiles' : ''}`}>
      <main>{children}</main>

      {micMuted && (
        <div className="narration-mode-indicator" role="status" aria-live="polite">
          <MicOff aria-hidden="true" />
          <span>Narration mode</span>
          <small>Compass cannot hear you · Press M to unmute</small>
        </div>
      )}

      <footer className="remote-help" aria-label="Remote control shortcuts">
        <span><kbd>↑ ↓ ← →</kbd> Move</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Back</span>
        <span><kbd>V</kbd> Voice</span>
        {(isVoiceSession || location.pathname.startsWith('/content/')) && (
          <span><kbd>M</kbd> Narration mode</span>
        )}
      </footer>
    </div>
  );
}
