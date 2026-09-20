import { MoltenMetal } from './MoltenMetal';
import { SoftAurora } from './SoftAurora';

interface VoiceSessionBackgroundProps {
  auroraActive: boolean;
  reduceMotion: boolean;
}

export function VoiceSessionBackground({
  auroraActive,
  reduceMotion: _reduceMotion,
}: VoiceSessionBackgroundProps) {
  return (
    <div
      className={`voice-session-background ${auroraActive ? 'voice-session-background--active' : 'voice-session-background--resting'}`}
      aria-hidden="true"
    >
      <MoltenMetal
        className="voice-session-background__metal"
        paused={false}
      />
      <SoftAurora
        className="voice-session-background__aurora"
        paused={!auroraActive}
      />
      <div className="voice-session-background__veil" />
    </div>
  );
}
