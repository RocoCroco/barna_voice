import type { Profile } from '../types/profile';

const MOCK_PROFILES: Profile[] = [
  { id: 'alex', name: 'Alex', initials: 'A', theme: 'cyan' },
  { id: 'sam', name: 'Sam', initials: 'S', theme: 'violet' },
  { id: 'family', name: 'Family', initials: 'F', theme: 'coral' },
  { id: 'guests', name: 'Guests', initials: 'G', theme: 'sage' },
];

const wait = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration));

export const profilesService = {
  async getProfiles(): Promise<Profile[]> {
    await wait(260);
    return MOCK_PROFILES;
  },

  async selectProfile(profileId: string): Promise<Profile> {
    await wait(180);
    const profile = MOCK_PROFILES.find((candidate) => candidate.id === profileId);

    if (!profile) {
      throw new Error(`Unknown profile: ${profileId}`);
    }

    return profile;
  },
};
