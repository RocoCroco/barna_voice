import type { BackendItem } from '../services/content.service';

export interface RecommendationsUpdated {
  type: 'recommendations.updated';
  sessionId: string;
  profileId: string;
  revision: number;
  message: string;
  criteria: string[];
  items: { contentId: string; score: number; reason?: string }[];
  catalog: BackendItem[];
}
