import type {
  RecommendationMode,
  RecommendationRound,
} from '../types/content';

const rounds: Record<RecommendationMode, RecommendationRound[]> = {
  discover: [
    {
      message:
        'I have picked three different places to start. We can refine them as we talk.',
      criteria: ['Good for a group', 'Under 2 hours'],
      contentIds: ['orbit-house', 'soft-landing', 'velvet-code'],
    },
    {
      message:
        'Got it: something more mature, with a story that pulls you in from the start.',
      criteria: ['Good for a group', 'Under 2 hours', 'More mature'],
      contentIds: ['afterlight', 'quiet-current', 'orbit-house'],
    },
    {
      message:
        'I will keep the runtime, but raise the pace without making it too violent.',
      criteria: ['Under 2 hours', 'More mature', 'Faster pace'],
      contentIds: ['northern-line', 'afterlight', 'orbit-house'],
    },
  ],
  consensus: [
    {
      message:
        'Tell me what each person feels like watching. I will find common ground without creating profiles.',
      criteria: ['Several viewers', 'Session-only preferences'],
      contentIds: ['soft-landing', 'orbit-house', 'small-wonders'],
    },
    {
      message:
        'I can see the overlap: adventure, some humour and nothing too long.',
      criteria: ['Adventure', 'Some humour', 'Under 2 hours'],
      contentIds: ['orbit-house', 'soft-landing', 'northern-line'],
    },
  ],
  decide: [
    {
      message:
        'I will ask only a few questions and narrow it down to three finalists.',
      criteria: ['Quick decision', 'Three finalists'],
      contentIds: ['afterlight', 'orbit-house', 'quiet-current'],
    },
    {
      message:
        'My pick is Afterlight: it best matches your available time and the tone you asked for.',
      criteria: ['Final pick', 'Under 2 hours', 'Light mystery'],
      contentIds: ['afterlight', 'orbit-house', 'quiet-current'],
    },
  ],
};

export const recommendationsService = {
  getRound(
    mode: RecommendationMode,
    index: number,
    profileId?: string | null,
  ): RecommendationRound {
    void profileId;
    const availableRounds = rounds[mode];
    return availableRounds[Math.min(index, availableRounds.length - 1)];
  },
  hasNextRound(mode: RecommendationMode, index: number): boolean {
    return index < rounds[mode].length - 1;
  },
};
