import type { PipecatClient } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { contentId, contentService, type BackendItem } from '../services/content.service';
import { useRecommendationStore } from '../store/recommendation.store';
import { useVoiceStore } from '../store/voice.store';
import { voiceProvider } from './VoiceProvider';

type Options = ConstructorParameters<typeof PipecatClient>[0];
interface ClientDouble {
  options: Options;
  audio: { stop: ReturnType<typeof vi.fn> };
  initDevices: ReturnType<typeof vi.fn>;
  startBotAndConnect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  enableMic: ReturnType<typeof vi.fn>;
}
const mock = vi.hoisted(() => ({ clients: [] as ClientDouble[] }));

vi.mock('@pipecat-ai/client-js', () => ({
  PipecatClient: class {
    audio = { stop: vi.fn() };
    tracks = vi.fn(() => ({ local: { audio: this.audio } }));
    mediaState = { mic: { state: 'granted' } };
    initDevices = vi.fn().mockResolvedValue(undefined);
    startBotAndConnect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    enableMic = vi.fn();
    constructor(public options: Options) { mock.clients.push(this); }
  },
}));
vi.mock('@pipecat-ai/small-webrtc-transport', () => ({ SmallWebRTCTransport: class {} }));

beforeEach(() => {
  mock.clients.length = 0;
  useRecommendationStore.getState().reset();
  useVoiceStore.getState().reset();
  useRecommendationStore.getState().startSession('discover', 'viewer');
});
afterEach(async () => {
  await voiceProvider.disconnect();
  vi.unstubAllGlobals();
});

function context() {
  return {
    profileId: 'viewer', mode: 'discover' as const,
    sessionId: useRecommendationStore.getState().sessionId!,
  };
}

it('threads username and session into the runner body and keeps one connection on pause/resume', async () => {
  await Promise.all([voiceProvider.connect(context()), voiceProvider.connect(context())]);
  const client = mock.clients[0];
  expect(mock.clients).toHaveLength(1);
  expect(client.startBotAndConnect).toHaveBeenCalledWith(expect.objectContaining({
    requestData: expect.objectContaining({ transport: 'webrtc', body: context() }),
  }));
  const audio = { setAttribute: vi.fn(), style: {}, play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(), remove: vi.fn(), muted: false };
  vi.stubGlobal('document', { createElement: () => audio, body: { append: vi.fn() } });
  vi.stubGlobal('MediaStream', class {});
  client.options.callbacks?.onTrackStarted?.({ id: 'remote', kind: 'audio' } as MediaStreamTrack);
  await voiceProvider.stopListening();
  client.options.callbacks?.onBotStartedSpeaking?.();
  expect(useVoiceStore.getState().status).toBe('paused');
  expect(audio.muted).toBe(true);
  await voiceProvider.connect(context());
  expect(useVoiceStore.getState().status).toBe('paused');
  await voiceProvider.startListening();
  expect(audio.muted).toBe(false);
  expect(voiceProvider.isConnected()).toBe(true);
  expect(client.enableMic).toHaveBeenCalledWith(false);
  expect(client.startBotAndConnect).toHaveBeenCalledTimes(1);
  expect(client.disconnect).not.toHaveBeenCalled();
});

it('routes server events to the board, retaining selection, criteria and detail on refinement', async () => {
  await voiceProvider.connect(context());
  const client = mock.clients[0];
  const first: BackendItem = {
    content_type: 'movie', title: 'Arrival', release_year: 2016,
    genres: ['Sci-Fi'], runtime_minutes: 116, matched_genre: 'Sci-Fi',
  };
  const second = { ...first, title: 'Moon', release_year: 2009 };
  const emit = (revision: number, catalog: BackendItem[]) =>
    client.options.callbacks?.onServerMessage?.({
      type: 'recommendations.updated', ...context(), revision, catalog,
      message: 'Your picks.', criteria: ['Sci-Fi', 'Up to 120 minutes'],
      items: catalog.map((item, index) => ({ contentId: contentId(item), score: 1 / (index + 1) })),
    });
  emit(1, [first, second]);
  const store = useRecommendationStore.getState();
  store.focusContent(contentId(first));
  store.selectContent(contentId(first));
  store.pause();
  await voiceProvider.stopListening();
  emit(2, [second, first]);
  expect(useRecommendationStore.getState()).toMatchObject({
    sessionId: context().sessionId, phase: 'exploring', round: 2,
    selectedContentId: contentId(first), focusedContentId: contentId(first),
    criteria: ['Sci-Fi', 'Up to 120 minutes'],
  });
  expect(contentService.getById(contentId(first))?.title).toBe('Arrival');
  expect(client.startBotAndConnect).toHaveBeenCalledTimes(1);
  expect(client.disconnect).not.toHaveBeenCalled();
});

it('does not resurrect a cancelled connection or accept callbacks from its old client', async () => {
  let finish: () => void = () => {};
  const connection = voiceProvider.connect(context());
  const old = mock.clients[0];
  old.startBotAndConnect.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await Promise.resolve();
  await voiceProvider.disconnect();
  finish();
  await connection;
  expect(voiceProvider.isConnected()).toBe(false);
  expect(old.audio.stop).toHaveBeenCalled();
  old.options.callbacks?.onConnected?.();
  expect(voiceProvider.isConnected()).toBe(false);
  old.options.callbacks?.onBotStartedSpeaking?.();
  expect(useVoiceStore.getState().status).toBe('disconnected');
});

it('releases the microphone when bot startup fails before a peer connection exists', async () => {
  const connection = voiceProvider.connect(context());
  const client = mock.clients[0];
  client.startBotAndConnect.mockRejectedValue(new Error('Failed to fetch'));
  await expect(connection).rejects.toThrow('Failed to fetch');
  expect(client.audio.stop).toHaveBeenCalled();
  expect(client.enableMic).toHaveBeenCalledWith(false);
  expect(client.disconnect).toHaveBeenCalled();
  expect(voiceProvider.isConnected()).toBe(false);
  expect(useVoiceStore.getState().status).toBe('disconnected');
});
