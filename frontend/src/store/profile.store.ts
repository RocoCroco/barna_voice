import { create } from 'zustand';
import type { Profile } from '../types/profile';

interface ProfileState {
  profiles: Profile[];
  activeProfile: Profile | null;
  isLoading: boolean;
  setProfiles: (profiles: Profile[]) => void;
  setActiveProfile: (profile: Profile) => void;
  setLoading: (isLoading: boolean) => void;
  clearActiveProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfile: null,
  isLoading: false,
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (activeProfile) => set({ activeProfile }),
  setLoading: (isLoading) => set({ isLoading }),
  clearActiveProfile: () => set({ activeProfile: null }),
}));
