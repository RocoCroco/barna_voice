import { useCallback } from 'react';
import { useRecommendationStore } from '../store/recommendation.store';
import { useVoiceStore } from '../store/voice.store';
import type { RecommendationMode } from '../types/content';
import { voiceProvider } from './VoiceProvider';

export function useVoiceAgent() {
  const status = useVoiceStore((state) => state.status);
  const transcript = useVoiceStore((state) => state.transcript);
  const setStatus = useVoiceStore((state) => state.setStatus);
  const setTranscript = useVoiceStore((state) => state.setTranscript);
  const startSession = useRecommendationStore((state) => state.startSession);
  const setPhase = useRecommendationStore((state) => state.setPhase);
  const pauseRecommendations = useRecommendationStore((state) => state.pause);
  const resumeRecommendations = useRecommendationStore((state) => state.resume);
  const resetRecommendations = useRecommendationStore((state) => state.reset);

  const start = useCallback(
    async (mode: RecommendationMode, profileId: string) => {
      const current = useRecommendationStore.getState();
      if (current.sessionId && current.mode === mode && current.profileId === profileId
        && (voiceProvider.isConnected() || current.round > 0)) return;
      startSession(mode, profileId);
      const sessionId = useRecommendationStore.getState().sessionId;
      try {
        if (!sessionId) return;
        await voiceProvider.connect({ profileId, mode, sessionId });
        if (useRecommendationStore.getState().sessionId !== sessionId
          || useRecommendationStore.getState().phase === 'exploring') return;
        await voiceProvider.startListening();
        setPhase('listening');
      } catch {
        if (useRecommendationStore.getState().sessionId === sessionId) setPhase('idle');
      }
    },
    [setPhase, startSession],
  );

  const pause = useCallback(async () => {
    pauseRecommendations();
    await voiceProvider.stopListening();
    setStatus(voiceProvider.isConnected() ? 'paused' : 'disconnected');
    if (voiceProvider.isConnected()) {
      setTranscript('Conversation paused. Explore these options with your remote.');
    }
  }, [pauseRecommendations, setStatus, setTranscript]);

  const resume = useCallback(async () => {
    try {
      await voiceProvider.startListening();
      resumeRecommendations();
      setStatus('listening');
      setTranscript('I am listening. What would you like to change?');
    } catch {
      useRecommendationStore.getState().setError('Voice disconnected. Start a new conversation from Home.');
    }
  }, [resumeRecommendations, setStatus, setTranscript]);

  const end = useCallback(async () => {
    resetRecommendations();
    await voiceProvider.disconnect();
    useVoiceStore.getState().reset();
  }, [resetRecommendations]);

  return {
    status,
    transcript,
    start,
    pause,
    resume,
    end,
  };
}
