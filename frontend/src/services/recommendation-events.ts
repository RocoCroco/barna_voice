import { contentId, type BackendItem } from './content.service';
import { useRecommendationStore } from '../store/recommendation.store';
import type { RecommendationsUpdated } from '../types/recommendations';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function isBackendItem(value: unknown): value is BackendItem {
  if (!isRecord(value)) return false;
  return ['movie', 'show', 'sport'].includes(String(value.content_type))
    && typeof value.title === 'string'
    && isStrings(value.genres)
    && (value.runtime_minutes === null
      || (typeof value.runtime_minutes === 'number' && Number.isFinite(value.runtime_minutes)))
    && (value.matched_genre === null || typeof value.matched_genre === 'string')
    && ['release_year', 'vote_average'].every((key) =>
      value[key] == null || (typeof value[key] === 'number' && Number.isFinite(value[key])))
    && ['channel', 'air_date', 'start_time', 'end_time', 'rating', 'league', 'match_date', 'kickoff_cet']
      .every((key) => value[key] == null || typeof value[key] === 'string');
}

export function isRecommendationsUpdated(value: unknown): value is RecommendationsUpdated {
  if (!isRecord(value) || value.type !== 'recommendations.updated'
    || typeof value.sessionId !== 'string' || typeof value.profileId !== 'string'
    || typeof value.message !== 'string' || !isStrings(value.criteria)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !Array.isArray(value.catalog) || !value.catalog.every(isBackendItem)
    || !Array.isArray(value.items) || value.items.length > 8) return false;

  const identifiers = new Set(value.catalog.map(contentId));
  const received = new Set<string>();
  return value.items.every((item: unknown) => {
    if (!isRecord(item) || typeof item.contentId !== 'string'
      || typeof item.score !== 'number' || !Number.isFinite(item.score)
      || (item.reason !== undefined && typeof item.reason !== 'string')
      || !identifiers.has(item.contentId) || received.has(item.contentId)) return false;
    received.add(item.contentId);
    return true;
  });
}

export function handleRecommendationMessage(value: unknown): void {
  const store = useRecommendationStore.getState();
  if (isRecommendationsUpdated(value)) {
    store.applyUpdate(value);
  } else if (isRecord(value) && value.type === 'recommendations.error'
    && value.sessionId === store.sessionId && value.profileId === store.profileId
    && typeof value.message === 'string') {
    store.setError(value.message);
  }
}
