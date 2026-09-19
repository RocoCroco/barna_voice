import { create } from 'zustand';

interface WatchlistState {
  contentIds: string[];
  toggle: (contentId: string) => void;
  contains: (contentId: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  contentIds: [],
  toggle: (contentId) =>
    set((state) => ({
      contentIds: state.contentIds.includes(contentId)
        ? state.contentIds.filter((id) => id !== contentId)
        : [...state.contentIds, contentId],
    })),
  contains: (contentId) => get().contentIds.includes(contentId),
}));

