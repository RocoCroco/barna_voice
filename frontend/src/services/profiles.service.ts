import type { Profile } from '../types/profile';
import { apiRequest } from './api';

const themes: Profile['theme'][] = ['cyan', 'violet', 'coral', 'sage'];

function toProfile(username: string): Profile {
  const themeIndex = Array.from(username).reduce(
    (sum, character) => sum + (character.codePointAt(0) ?? 0),
    0,
  ) % themes.length;

  return {
    id: username,
    name: username,
    initials: username.split(/[\s_-]+/).filter(Boolean)
      .slice(0, 2).map((part) => Array.from(part)[0]).join('').toUpperCase(),
    theme: themes[themeIndex],
  };
}

export const profilesService = {
  async getProfiles(): Promise<Profile[]> {
    const { users } = await apiRequest<{ users: string[] }>('/api/users');
    return users.map(toProfile);
  },

  async selectProfile(profileId: string): Promise<Profile> {
    const profiles = await profilesService.getProfiles();
    const profile = profiles.find((candidate) => candidate.id === profileId);

    if (!profile) {
      throw new Error(`Unknown profile: ${profileId}`);
    }

    return profile;
  },
};
