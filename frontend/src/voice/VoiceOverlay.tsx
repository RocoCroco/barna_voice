import type { VoiceStatus } from '../types/voice';

interface VoiceOverlayProps {
  status: VoiceStatus;
  transcript: string;
}

const statusLabels: Record<VoiceStatus, string> = {
  disconnected: 'Voice offline',
  ready: 'Ready',
  listening: 'Listening',
  processing: 'Thinking',
  speaking: 'Speaking',
  paused: 'Paused',
};

export function VoiceOverlay({ status, transcript }: VoiceOverlayProps) {
  return (
    <aside className={`voice-overlay voice-overlay--${status}`} aria-live="polite">
      <span className="voice-orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="voice-overlay__copy">
        <span className="voice-overlay__status">{statusLabels[status]}</span>
        <strong>{transcript || 'Start a conversation when you are ready.'}</strong>
      </span>
    </aside>
  );
}

