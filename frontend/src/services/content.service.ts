import type { Content, ContentTheme } from '../types/content';
import { apiRequest } from './api';

export interface BackendItem {
  content_type: 'movie' | 'show' | 'sport';
  title: string;
  genres: string[];
  runtime_minutes: number | null;
  matched_genre: string | null;
  release_year?: number | null;
  vote_average?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  synopsis?: string | null;
  channel?: string | null;
  air_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  rating?: string | null;
  league?: string | null;
  match_date?: string | null;
  kickoff_cet?: string | null;
}

export interface BackendRecommendations {
  mode: string;
  status: string;
  items: BackendItem[];
}

const themes: ContentTheme[] = ['aurora', 'ember', 'ocean', 'orchid', 'sand', 'forest'];
const cache = new Map<string, Content>();
let scope: string | null = null;

export function contentId(item: BackendItem): string {
  return JSON.stringify([
    item.content_type, item.title,
    item.release_year ?? item.air_date ?? item.match_date ?? null,
    item.channel ?? null,
    item.start_time ?? item.kickoff_cet ?? null,
  ]);
}

export function adaptContent(item: BackendItem, reason?: string): Content {
  const id = contentId(item);
  const minutes = item.runtime_minutes;
  const themeIndex = Array.from(id).reduce((sum, letter) => sum + (letter.codePointAt(0) ?? 0), 0);
  const details = item.content_type === 'show'
    ? [item.channel, item.air_date, item.start_time].filter(Boolean).join(' · ')
    : item.content_type === 'sport'
      ? [item.league, item.match_date, item.kickoff_cet].filter(Boolean).join(' · ')
      : '';
  const imagePath = item.poster_path ?? item.backdrop_path;
  const posterUrl = imagePath?.startsWith('/')
    ? `https://image.tmdb.org/t/p/w500${imagePath}`
    : null;

  return {
    id,
    title: item.title,
    kind: item.content_type === 'show' ? 'series' : item.content_type,
    year: item.release_year ?? null,
    duration: minutes && minutes > 0 ? `${minutes} min` : 'Runtime unknown',
    maturityRating: item.rating || 'Rating unavailable',
    genres: item.genres,
    synopsis: item.synopsis || details || 'Synopsis not provided by the catalogue.',
    recommendationReason: reason ?? (item.matched_genre
      ? `Matches ${item.matched_genre}.`
      : 'Selected by the recommendation service.'),
    theme: themes[themeIndex % themes.length],
    posterUrl,
  };
}

export const contentService = {
  setScope(nextScope: string | null) {
    if (scope !== nextScope) cache.clear();
    scope = nextScope;
  },
  remember(
    items: BackendItem[],
    expectedScope: string | null = scope,
    reasons: Map<string, string | undefined> = new Map(),
  ): Content[] {
    if (expectedScope !== scope) return [];
    return items.map((item) => {
      const content = adaptContent(item, reasons.get(contentId(item)));
      cache.set(content.id, content);
      return content;
    });
  },
  async request(path: string, body: object): Promise<Content[]> {
    const requestedScope = scope;
    const response = await apiRequest<BackendRecommendations>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return contentService.remember(response.items, requestedScope);
  },
  getFeatured: (profileId: string) => contentService.request(
    '/api/content/decide', { user_id: profileId, count: 6 },
  ),
  getAll: () => [...cache.values()],
  getById: (id: string) => cache.get(id),
};
