import type { RecommendationMode, RecommendationRound } from '../types/content';
import { contentService } from './content.service';

export interface Preferences {
  genre?: string | null;
  duration?: number | null;
  mood?: string | null;
  query?: string | null;
  content_types?: ('movie' | 'show' | 'sport')[];
  participants?: ParticipantPreferences[];
}

export interface ParticipantPreferences {
  user_id?: string;
  genre?: string | null;
  duration?: number | null;
  mood?: string | null;
  query?: string | null;
}

export const recommendationEndpoints = {
  discover: '/api/content/preference',
  consensus: '/api/content/room',
  decide: '/api/content/decide',
} satisfies Record<RecommendationMode, string>;

export function preferenceCriteria(preferences: Preferences): string[] {
  const describe = (entry: ParticipantPreferences) => [
    entry.genre,
    entry.duration ? `Up to ${entry.duration} minutes` : null,
    entry.mood,
    entry.query,
  ].filter((value): value is string => Boolean(value));
  return [...new Set([
    ...describe(preferences),
    ...(preferences.content_types ?? []),
    ...(preferences.participants ?? []).flatMap(describe),
  ])];
}

export const recommendationsService = {
  async getRound(
    mode: RecommendationMode,
    preferences: Preferences,
    profileId: string,
  ): Promise<RecommendationRound> {
    const { genre, duration, mood, query, content_types } = preferences;
    const common = { count: 8, content_types };
    const body = mode === 'decide'
      ? { count: 1, content_types: ['movie'], randomize: true, user_id: profileId }
      : mode === 'consensus'
        ? {
            ...common,
            participants: preferences.participants?.length
              ? preferences.participants
              : [{ user_id: profileId, genre, duration, mood, query }],
          }
        : { ...common, genre, duration, mood, query };
    const items = await contentService.request(recommendationEndpoints[mode], body);
    return {
      message: items.length
        ? mode === 'decide' ? 'Here is my pick for you.' : 'Here are your picks. Tell me what you would like to change.'
        : 'No titles were returned.',
      criteria: mode === 'decide' ? ['One surprise movie'] : preferenceCriteria(preferences),
      contentIds: items.map((item) => item.id),
    };
  },
};
