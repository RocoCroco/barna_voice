import { MOCK_CONTENT } from '../mocks/content';

export const contentService = {
  getFeatured: () => MOCK_CONTENT.slice(0, 6),
  getAll: () => MOCK_CONTENT,
  getById: (id: string) => MOCK_CONTENT.find((item) => item.id === id),
};

