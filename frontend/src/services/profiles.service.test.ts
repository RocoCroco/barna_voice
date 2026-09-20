import { afterEach, describe, expect, it, vi } from 'vitest';
import { profilesService } from './profiles.service';

afterEach(() => vi.unstubAllGlobals());

describe('profilesService', () => {
  it('keeps backend IDs while presenting friendly profile names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      users: [
        'user_1_cinephile',
        'user_2_skipper',
        'user_3_morning_parent',
        'user_4_anime_fan',
        'user_5_comfort_watcher',
      ],
    })));

    const profiles = await profilesService.getProfiles();

    expect(profiles.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'user_1_cinephile', name: 'Jhon (Cinephile)' },
      { id: 'user_2_skipper', name: 'Mia (Skipper)' },
      { id: 'user_3_morning_parent', name: 'Sofia (Morning Parent)' },
      { id: 'user_4_anime_fan', name: 'Leo (Anime Fan)' },
      { id: 'user_5_comfort_watcher', name: 'Emma (Comfort Watcher)' },
    ]);
    expect(profiles[0].initials).toBe('JC');
  });
});
