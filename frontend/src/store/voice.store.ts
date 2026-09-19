import { create } from 'zustand';
import type { VoiceStatus } from '../types/voice';

interface VoiceState {
  status: VoiceStatus;
  transcript: string;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (transcript: string) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'disconnected',
  transcript: '',
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  reset: () => set({ status: 'disconnected', transcript: '' }),
}));

