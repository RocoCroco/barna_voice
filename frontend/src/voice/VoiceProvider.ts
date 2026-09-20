import { PipecatClient, type BotOutputData } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import { handleRecommendationMessage } from '../services/recommendation-events';
import { useRecommendationStore } from '../store/recommendation.store';
import { useVoiceStore } from '../store/voice.store';
import type { VoiceProvider, VoiceSessionContext, VoiceStatus } from '../types/voice';

const defaultAgentUrl = 'http://localhost:7860';

function agentUrl() {
  return (import.meta.env.VITE_VOICE_AGENT_URL || defaultAgentUrl).replace(/\/$/, '');
}

function setVoice(status: VoiceStatus, transcript?: string) {
  const state = useVoiceStore.getState();
  if (state.status === 'paused' && status !== 'disconnected' && status !== 'paused') return;
  state.setStatus(status);
  if (transcript) state.setTranscript(transcript);
  if (useRecommendationStore.getState().phase !== 'exploring'
    && (status === 'listening' || status === 'processing' || status === 'speaking')) {
    useRecommendationStore.getState().setPhase(status);
  }
}

function errorText(value: unknown): string {
  const friendly = (message: string) => {
    if (
      message.includes('Could not start audio source') ||
      message.includes('speech recognition service completed before input was closed')
    ) {
      return 'The microphone is busy. Close the other Compass or Pipecat tab, then try again.';
    }
    return message;
  };

  if (value instanceof Error) return friendly(value.message);
  if (typeof value === 'string') return friendly(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return friendly(record.error);
    if (typeof record.message === 'string') return friendly(record.message);
    if (record.data && typeof record.data === 'object') return errorText(record.data);
  }
  return 'Compass could not start the voice session.';
}

function isRecoverableVoiceError(value: unknown): boolean {
  const message = errorText(value).toLowerCase();
  return message.includes('abandoned: interrupted mid-utterance')
    || (message.includes('slng tts context') && message.includes('interrupted'));
}

class PipecatVoiceProvider implements VoiceProvider {
  private client: PipecatClient | null = null;
  private connection: Promise<void> | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private remoteAudioTrackId: string | null = null;
  private connected = false;
  private listening = false;
  private micMuted = false;
  private sessionId: string | null = null;

  private playRemoteAudio(track: MediaStreamTrack) {
    if (!this.remoteAudio) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('aria-hidden', 'true');
      audio.style.display = 'none';
      document.body.append(audio);
      this.remoteAudio = audio;
    }

    this.remoteAudioTrackId = track.id;
    this.remoteAudio.srcObject = new MediaStream([track]);
    this.remoteAudio.muted = !this.listening;
    void this.remoteAudio.play().catch(() => {
      if (this.remoteAudioTrackId !== track.id) return;
      setVoice(
        'speaking',
        'Compass is speaking, but browser audio is blocked. Check your TV or browser volume.',
      );
    });
  }

  private stopRemoteAudio(track?: MediaStreamTrack) {
    if (track && track.id !== this.remoteAudioTrackId) return;

    this.remoteAudio?.pause();
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
    }
    this.remoteAudio = null;
    this.remoteAudioTrackId = null;
  }

  private async releaseClient(client: PipecatClient): Promise<void> {
    client.enableMic(false);
    for (const track of Object.values(client.tracks().local)) track?.stop();
    try {
      await client.disconnect();
    } catch {
      // The agent may have already ended the session; local cleanup still succeeds.
    }
  }

  private createClient() {
    const voice = (status: VoiceStatus, transcript?: string) => {
      if (this.client === client) setVoice(status, transcript);
    };
    const fail = (message: string) => {
      if (this.client !== client) return;
      useRecommendationStore.getState().setError(message);
      voice('disconnected', message);
      void this.disconnect();
    };
    const client = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      enableCam: false,
      callbacks: {
        onServerMessage: (data: unknown) => {
          if (this.client === client) handleRecommendationMessage(data);
        },
        onConnected: () => {
          if (this.client !== client) return;
          this.connected = true;
        },
        onDisconnected: () => {
          if (this.client !== client) return;
          this.connected = false;
          this.listening = false;
          this.micMuted = false;
          useVoiceStore.getState().setMicMuted(false);
          this.stopRemoteAudio();
          setVoice('disconnected');
          useRecommendationStore.getState().setError('Voice session ended. Start a new conversation from Home.');
        },
        onUserStartedSpeaking: () => voice('listening'),
        onUserStoppedSpeaking: () => voice('processing'),
        onUserTranscript: ({ text, final }) => {
          if (text.trim()) voice(final ? 'processing' : 'listening', text.trim());
        },
        onBotLlmStarted: () => voice('processing', 'Compass is thinking…'),
        onBotStartedSpeaking: () => voice('speaking'),
        onBotOutput: (data: BotOutputData) => {
          if (data.text.trim()) voice('speaking', data.text.trim());
        },
        onBotStoppedSpeaking: () => {
          if (this.listening) voice('listening', 'Just talk it out…');
        },
        onTrackStarted: (track, participant) => {
          if (this.client === client && track.kind === 'audio' && participant?.local !== true) {
            this.playRemoteAudio(track);
          }
        },
        onTrackStopped: (track, participant) => {
          if (this.client === client && track.kind === 'audio' && participant?.local !== true) {
            this.stopRemoteAudio(track);
          }
        },
        onDeviceError: (error) => {
          fail(`Microphone unavailable: ${errorText(error)}`);
        },
        onError: (error) => {
          if (isRecoverableVoiceError(error)) {
            useRecommendationStore.getState().setError(null);
            if (this.listening) voice('listening');
            return;
          }
          fail(errorText(error));
        },
      },
    });
    return client;
  }

  async connect(context: VoiceSessionContext): Promise<void> {
    if (this.sessionId === context.sessionId) {
      if (this.connection) return this.connection;
      if (this.connected) return;
    }
    if (this.client) await this.disconnect();

    this.sessionId = context.sessionId;
    this.listening = true;
    this.micMuted = false;
    useVoiceStore.getState().setMicMuted(false);
    this.client = this.createClient();
    useVoiceStore.getState().setStatus('processing');
    useRecommendationStore.getState().setError(null);
    setVoice('processing', 'Connecting to Compass…');

    const client = this.client;
    this.connection = (async () => {
      await client.initDevices();
      if (this.client !== client) {
        await this.releaseClient(client);
        return;
      }
      if (client.mediaState.mic.state !== 'granted') {
        throw new Error(
          'The microphone is busy. Close the other Compass or Pipecat tab, then try again.',
        );
      }

      await client.startBotAndConnect({
          endpoint: `${agentUrl()}/start`,
          requestData: {
            transport: 'webrtc',
            createDailyRoom: false,
            enableDefaultIceServers: true,
            body: { ...context },
          },
        });
    })()
      .then(() => {
        if (this.client !== client) {
          void this.releaseClient(client);
          return;
        }
        this.connected = true;
        client.enableMic(this.listening && !this.micMuted);
        if (this.listening) setVoice('listening', 'Just talk it out…');
      })
      .catch(async (error: unknown) => {
        if (this.client === client) {
          await this.disconnect();
          setVoice('disconnected', errorText(error));
          useRecommendationStore.getState().setError(errorText(error));
        }
        throw error;
      })
      .finally(() => {
        if (this.client === client) this.connection = null;
      });

    return this.connection;
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connection = null;
    this.connected = false;
    this.listening = false;
    this.micMuted = false;
    this.sessionId = null;
    useVoiceStore.getState().setMicMuted(false);
    this.stopRemoteAudio();
    if (client) await this.releaseClient(client);
    if (!this.client) setVoice('disconnected');
  }

  async startListening(): Promise<void> {
    if (!this.connected) throw new Error('Start a voice session before resuming.');
    this.client?.enableMic(!this.micMuted);
    this.listening = true;
    if (this.remoteAudio) this.remoteAudio.muted = false;
    useVoiceStore.getState().setStatus('listening');
    setVoice('listening');
  }

  async stopListening(): Promise<void> {
    this.client?.enableMic(false);
    this.listening = false;
    if (this.remoteAudio) this.remoteAudio.muted = true;
    if (this.connected || this.connection) setVoice('paused');
  }

  setMicrophoneMuted(muted: boolean): void {
    if (!this.connected && !this.connection) return;
    this.micMuted = muted;
    this.client?.enableMic(this.listening && !muted);
    useVoiceStore.getState().setMicMuted(muted);
  }

  toggleMicrophoneMuted(): boolean {
    if (!this.connected && !this.connection) return this.micMuted;
    this.setMicrophoneMuted(!this.micMuted);
    return this.micMuted;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isListening(): boolean {
    return this.listening;
  }

  isMicrophoneMuted(): boolean {
    return this.micMuted;
  }
}

export const voiceProvider = new PipecatVoiceProvider();
