import { beforeEach, describe, expect, it } from 'vitest';
import { contentId, contentService, type BackendItem } from './content.service';
import { handleRecommendationMessage } from './recommendation-events';
import { useRecommendationStore } from '../store/recommendation.store';
import type { RecommendationsUpdated } from '../types/recommendations';

const movie: BackendItem = {
  content_type: 'movie', title: 'Arrival', release_year: 2016,
  genres: ['Science Fiction'], runtime_minutes: 116, matched_genre: 'Sci-Fi',
  poster_path: '/arrival.jpg',
};

function update(overrides: Partial<RecommendationsUpdated> = {}): RecommendationsUpdated {
  const { sessionId } = useRecommendationStore.getState();
  return {
    type: 'recommendations.updated', sessionId: sessionId!, profileId: 'viewer', revision: 1,
    message: 'Your picks are ready.', criteria: ['Under 120 minutes'],
    items: [{ contentId: contentId(movie), score: 1, reason: 'A thoughtful choice.' }],
    catalog: [movie], ...overrides,
  };
}

beforeEach(() => {
  useRecommendationStore.getState().reset();
  useRecommendationStore.getState().startSession('discover', 'viewer');
});

describe('structured voice recommendations', () => {
  it('updates the board and cached detail from the event, without a transcript parser', () => {
    handleRecommendationMessage(update());
    expect(useRecommendationStore.getState()).toMatchObject({
      round: 1, contentIds: [contentId(movie)], criteria: ['Under 120 minutes'],
      agentMessage: 'Your picks are ready.',
    });
    expect(contentService.getById(contentId(movie))).toMatchObject({
      title: 'Arrival', recommendationReason: 'A thoughtful choice.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/arrival.jpg',
    });
  });

  it('ignores malformed, foreign-profile, stale-session and duplicate updates', () => {
    handleRecommendationMessage(update({ profileId: 'other' }));
    handleRecommendationMessage(update({ sessionId: 'old' }));
    handleRecommendationMessage({ ...update(), catalog: [{ title: 'bad' }] });
    handleRecommendationMessage(update({ items: [{ contentId: 'unknown', score: 1 }] }));
    expect(contentService.getAll()).toEqual([]);
    handleRecommendationMessage(update({ revision: 2 }));
    handleRecommendationMessage(update({ revision: 1, message: 'stale' }));
    handleRecommendationMessage(update({ revision: 2, message: 'duplicate' }));
    expect(useRecommendationStore.getState().round).toBe(1);
    expect(useRecommendationStore.getState().agentMessage).toBe('Your picks are ready.');
  });

  it('retains exploration and cached detail across refinement and empty results', () => {
    handleRecommendationMessage(update());
    useRecommendationStore.getState().pause();
    handleRecommendationMessage(update({ revision: 2, catalog: [], items: [], criteria: ['Comedy'] }));
    expect(useRecommendationStore.getState()).toMatchObject({
      phase: 'exploring', contentIds: [], criteria: ['Comedy'],
    });
    expect(contentService.getById(contentId(movie))?.title).toBe('Arrival');
  });

  it('surfaces scoped tool errors without dropping the last board', () => {
    handleRecommendationMessage(update());
    const { sessionId } = useRecommendationStore.getState();
    handleRecommendationMessage({
      type: 'recommendations.error', sessionId, profileId: 'viewer', message: 'Backend unavailable.',
    });
    expect(useRecommendationStore.getState()).toMatchObject({
      contentIds: [contentId(movie)], error: 'Backend unavailable.',
    });
    handleRecommendationMessage(update({ revision: 2 }));
    expect(useRecommendationStore.getState().error).toBeNull();
  });
});
