import { create } from 'zustand';
import type { VoiceStatus } from '../types/voice';

interface VoiceState {
  status: VoiceStatus;
  transcript: string;
  micMuted: boolean;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (transcript: string) => void;
  setMicMuted: (micMuted: boolean) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'disconnected',
  transcript: '',
  micMuted: false,
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setMicMuted: (micMuted) => set({ micMuted }),
  reset: () => set({ status: 'disconnected', transcript: '', micMuted: false }),
}));

