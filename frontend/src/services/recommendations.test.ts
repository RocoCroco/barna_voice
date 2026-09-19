import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adaptContent, contentId, contentService, type BackendItem } from './content.service';
import { recommendationsService } from './recommendations.service';
import { useProfileStore } from '../store/profile.store';
import { useRecommendationStore } from '../store/recommendation.store';

const movie: BackendItem = {
  content_type: 'movie', title: 'Arrival', release_year: 2016,
  genres: ['Science Fiction'], runtime_minutes: 116, matched_genre: 'Sci-Fi',
};

beforeEach(() => {
  useRecommendationStore.getState().reset();
  useProfileStore.getState().setActiveProfile({
    id: 'viewer', name: 'viewer', initials: 'V', theme: 'cyan',
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('content identity and session cache', () => {
  it('keeps IDs stable across rankings and separates editions and broadcasts', () => {
    expect(contentId(movie)).toBe('["movie","Arrival",2016,null,null]');
    expect(contentId({ ...movie, matched_genre: 'Drama' })).toBe(contentId(movie));
    expect(contentId({ ...movie, release_year: 1996 })).not.toBe(contentId(movie));
    const show: BackendItem = {
      ...movie, content_type: 'show', release_year: null,
      channel: 'One', air_date: '2026-09-19', start_time: '18:00',
    };
    expect(contentId({ ...show, start_time: '19:00' })).not.toBe(contentId(show));
    expect(adaptContent(show).year).toBeNull();
    expect(adaptContent({ ...movie, content_type: 'sport' }).kind).toBe('sport');
  });

  it('does not let a late response repopulate a different session', async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    contentService.setScope('old');
    const request = contentService.getFeatured('viewer');
    contentService.setScope('new');
    finish(Response.json({ items: [movie] }));
    expect(await request).toEqual([]);
    expect(contentService.getAll()).toEqual([]);
  });
});

describe('backend recommendation modes', () => {
  it.each([
    ['discover', 'preference', { genre: 'Sci-Fi', duration: 120, mood: 'calm', count: 8 }],
    ['decide', 'decide', { user_id: 'viewer', count: 8 }],
    ['consensus', 'room', {
      participants: [{ user_id: 'viewer', genre: 'Sci-Fi', duration: 120, mood: 'calm' }], count: 8,
    }],
  ] as const)('maps %s and returns detail-resolvable IDs', async (mode, endpoint, expected) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ items: [movie] }));
    vi.stubGlobal('fetch', fetch);
    const round = await recommendationsService.getRound(
      mode, { genre: 'Sci-Fi', duration: 120, mood: 'calm' }, 'viewer',
    );
    const [url, options] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:8000/api/content/${endpoint}`);
    expect(JSON.parse(String(options.body))).toEqual(expected);
    expect(options.headers).toMatchObject({ 'X-Profile-Id': 'viewer' });
    expect(contentService.getById(round.contentIds[0])?.title).toBe('Arrival');
  });

  it('sends independent room participants and retains unchanged criteria on refinement', async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({ items: [movie] }));
    vi.stubGlobal('fetch', fetch);
    const store = useRecommendationStore.getState();
    store.startSession('consensus', 'viewer');
    await store.advance({ participants: [{ genre: 'Drama' }, { mood: 'fun' }], duration: 120 });
    await store.advance({ mood: 'calm' });
    expect(useRecommendationStore.getState().preferences.duration).toBe(120);
    const request = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(request.participants).toEqual([{ genre: 'Drama' }, { mood: 'fun' }]);
  });
});
