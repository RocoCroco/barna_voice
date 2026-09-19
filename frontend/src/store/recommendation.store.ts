import { create } from 'zustand';
import { recommendationsService } from '../services/recommendations.service';
import type {
  RecommendationMode,
  RecommendationPhase,
} from '../types/content';

interface RecommendationState {
  mode: RecommendationMode;
  profileId: string | null;
  phase: RecommendationPhase;
  round: number;
  criteria: string[];
  contentIds: string[];
  agentMessage: string;
  startSession: (mode: RecommendationMode, profileId: string) => void;
  setPhase: (phase: RecommendationPhase) => void;
  advance: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

const initialRound = recommendationsService.getRound('discover', 0);

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  mode: 'discover',
  profileId: null,
  phase: 'idle',
  round: 0,
  criteria: initialRound.criteria,
  contentIds: initialRound.contentIds,
  agentMessage: initialRound.message,

  startSession: (mode, profileId) => {
    const firstRound = recommendationsService.getRound(mode, 0, profileId);
    set({
      mode,
      profileId,
      phase: 'speaking',
      round: 0,
      criteria: firstRound.criteria,
      contentIds: firstRound.contentIds,
      agentMessage: firstRound.message,
    });
  },

  setPhase: (phase) => set({ phase }),

  advance: () => {
    const { mode, profileId, round } = get();
    const nextRound = recommendationsService.hasNextRound(mode, round)
      ? round + 1
      : 0;
    const result = recommendationsService.getRound(mode, nextRound, profileId);
    set({
      phase: 'speaking',
      round: nextRound,
      criteria: result.criteria,
      contentIds: result.contentIds,
      agentMessage: result.message,
    });
  },

  pause: () => set({ phase: 'exploring' }),
  resume: () => set({ phase: 'listening' }),
  reset: () => set({ phase: 'idle', round: 0 }),
}));
