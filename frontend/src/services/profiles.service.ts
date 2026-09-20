import type { Profile } from '../types/profile';
import { apiRequest } from './api';

const themes: Profile['theme'][] = ['cyan', 'violet', 'coral', 'sage'];

const profileNames: Record<string, string> = {
  user_1_cinephile: 'Jhon (Cinephile)',
  user_2_skipper: 'Mia (Skipper)',
  user_3_morning_parent: 'Sofia (Morning Parent)',
  user_4_anime_fan: 'Leo (Anime Fan)',
  user_5_comfort_watcher: 'Emma (Comfort Watcher)',
};

function fallbackName(username: string): string {
  const persona = username
    .replace(/^user_?\d*_?/i, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

  return persona ? `Guest (${persona})` : 'Guest';
}

function toProfile(username: string): Profile {
  const themeIndex = Array.from(username).reduce(
    (sum, character) => sum + (character.codePointAt(0) ?? 0),
    0,
  ) % themes.length;

  const name = profileNames[username] ?? fallbackName(username);

  return {
    id: username,
    name,
    initials: name.replace(/[()]/g, '').split(/\s+/).filter(Boolean)
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
