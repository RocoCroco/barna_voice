export type ContentKind = 'movie' | 'series' | 'sport';

export type ContentTheme =
  | 'aurora'
  | 'ember'
  | 'ocean'
  | 'orchid'
  | 'sand'
  | 'forest';

export interface Content {
  id: string;
  title: string;
  kind: ContentKind;
  year: number | null;
  duration: string;
  maturityRating: string;
  genres: string[];
  synopsis: string;
  recommendationReason: string;
  theme: ContentTheme;
  posterUrl?: string | null;
}

export type RecommendationMode = 'discover' | 'consensus' | 'decide';

export type RecommendationPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'exploring';

export interface RecommendationRound {
  message: string;
  criteria: string[];
  contentIds: string[];
}
