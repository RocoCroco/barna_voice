import { create } from 'zustand';
import { recommendationsService, type Preferences } from '../services/recommendations.service';
import { contentService } from '../services/content.service';
import type { RecommendationsUpdated } from '../types/recommendations';
import type {
  RecommendationMode,
  RecommendationPhase,
} from '../types/content';

interface RecommendationState {
  mode: RecommendationMode;
  profileId: string | null;
  sessionId: string | null;
  preferences: Preferences;
  error: string | null;
  phase: RecommendationPhase;
  round: number;
  revision: number;
  focusedContentId: string | null;
  selectedContentId: string | null;
  criteria: string[];
  contentIds: string[];
  agentMessage: string;
  startSession: (mode: RecommendationMode, profileId: string) => void;
  setPhase: (phase: RecommendationPhase) => void;
  setError: (error: string | null) => void;
  applyUpdate: (event: RecommendationsUpdated) => void;
  focusContent: (id: string) => void;
  selectContent: (id: string) => void;
  advance: (changes?: Preferences) => Promise<void>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
  mode: 'discover',
  profileId: null,
  sessionId: null,
  preferences: {},
  error: null,
  phase: 'idle',
  round: 0,
  revision: 0,
  focusedContentId: null,
  selectedContentId: null,
  criteria: [],
  contentIds: [],
  agentMessage: '',

  startSession: (mode, profileId) => {
    const current = get();
    if (current.sessionId && current.profileId === profileId && current.mode === mode) return;
    const sessionId = crypto.randomUUID();
    contentService.setScope(sessionId);
    set({
      mode,
      profileId,
      sessionId,
      preferences: {},
      error: null,
      phase: 'listening',
      round: 0,
      revision: 0,
      focusedContentId: null,
      selectedContentId: null,
      criteria: [],
      contentIds: [],
      agentMessage: '',
    });
  },

  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error }),
  focusContent: (focusedContentId) => set({ focusedContentId }),
  selectContent: (selectedContentId) => set({ selectedContentId }),

  applyUpdate: (event) => {
    const current = get();
    if (event.sessionId !== current.sessionId || event.profileId !== current.profileId
      || event.revision <= current.revision) return;
    const reasons = new Map(event.items.map((item) => [item.contentId, item.reason]));
    contentService.remember(event.catalog, current.sessionId, reasons);
    set({
      revision: event.revision,
      round: current.round + 1,
      error: null,
      agentMessage: event.message,
      criteria: event.criteria,
      contentIds: event.items.map((item) => item.contentId),
      focusedContentId: event.items.some((item) => item.contentId === current.focusedContentId)
        ? current.focusedContentId : event.items[0]?.contentId ?? null,
    });
  },

  advance: async (changes = {}) => {
    const { mode, profileId, sessionId, preferences } = get();
    if (!profileId || !sessionId) return;
    const nextPreferences = { ...preferences, ...changes };
    set({ phase: 'processing', error: null });
    try {
      const result = await recommendationsService.getRound(mode, nextPreferences, profileId);
      if (get().sessionId !== sessionId) return;
      set({
        preferences: nextPreferences,
        phase: get().phase === 'exploring' ? 'exploring' : 'listening',
        round: get().round + 1,
        criteria: result.criteria,
        contentIds: result.contentIds,
        agentMessage: result.message,
      });
    } catch {
      if (get().sessionId === sessionId) {
        set({ error: 'Could not load recommendations. Please try again.', phase: 'listening' });
      }
    }
  },

  pause: () => set({ phase: 'exploring' }),
  resume: () => set({ phase: 'listening' }),
  reset: () => {
    contentService.setScope(null);
    set({
      phase: 'idle', round: 0, revision: 0, sessionId: null, profileId: null,
      focusedContentId: null, selectedContentId: null,
      preferences: {}, criteria: [], contentIds: [], agentMessage: '', error: null,
    });
  },
}));
