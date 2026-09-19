import { useCallback } from 'react';
import { useRecommendationStore } from '../store/recommendation.store';
import { useVoiceStore } from '../store/voice.store';
import type { RecommendationMode } from '../types/content';
import { voiceProvider } from './VoiceProvider';

const simulatedPhrases = [
  'Something a little more mature.',
  'Keep it under two hours, but give it more pace.',
];

const wait = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration));

export function useVoiceAgent() {
  const status = useVoiceStore((state) => state.status);
  const transcript = useVoiceStore((state) => state.transcript);
  const setStatus = useVoiceStore((state) => state.setStatus);
  const setTranscript = useVoiceStore((state) => state.setTranscript);
  const round = useRecommendationStore((state) => state.round);
  const startSession = useRecommendationStore((state) => state.startSession);
  const setPhase = useRecommendationStore((state) => state.setPhase);
  const advance = useRecommendationStore((state) => state.advance);
  const pauseRecommendations = useRecommendationStore((state) => state.pause);
  const resumeRecommendations = useRecommendationStore((state) => state.resume);
  const resetRecommendations = useRecommendationStore((state) => state.reset);

  const start = useCallback(
    async (mode: RecommendationMode, profileId: string) => {
      startSession(mode, profileId);
      try {
        await voiceProvider.connect();
        await voiceProvider.startListening();
        setPhase('listening');
      } catch {
        setPhase('idle');
      }
    },
    [setPhase, startSession],
  );

  const simulateTurn = useCallback(async () => {
    if (voiceProvider.isConnected()) {
      await voiceProvider.startListening();
    }
    setStatus('listening');
    setPhase('listening');
    setTranscript(simulatedPhrases[Math.min(round, simulatedPhrases.length - 1)]);
    await wait(450);

    setStatus('processing');
    setPhase('processing');
    if (voiceProvider.isConnected()) {
      await voiceProvider.stopListening();
    }
    await wait(550);

    advance();
    setStatus('speaking');
    setTranscript(useRecommendationStore.getState().agentMessage);
  }, [advance, round, setPhase, setStatus, setTranscript]);

  const pause = useCallback(async () => {
    await voiceProvider.stopListening();
    pauseRecommendations();
    setStatus('paused');
    setTranscript('Conversation paused. Explore these options with your remote.');
  }, [pauseRecommendations, setStatus, setTranscript]);

  const resume = useCallback(async () => {
    await voiceProvider.startListening();
    resumeRecommendations();
    setStatus('listening');
    setTranscript('I am listening. What would you like to change?');
  }, [resumeRecommendations, setStatus, setTranscript]);

  const end = useCallback(async () => {
    await voiceProvider.disconnect();
    resetRecommendations();
    useVoiceStore.getState().reset();
  }, [resetRecommendations]);

  return {
    status,
    transcript,
    start,
    simulateTurn,
    pause,
    resume,
    end,
  };
}
