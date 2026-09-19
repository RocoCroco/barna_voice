import { PipecatClient, type BotOutputData } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import { useVoiceStore } from '../store/voice.store';
import type { VoiceProvider, VoiceStatus } from '../types/voice';

const defaultAgentUrl = 'http://localhost:7860';

function agentUrl() {
  return (import.meta.env.VITE_VOICE_AGENT_URL || defaultAgentUrl).replace(/\/$/, '');
}

function setVoice(status: VoiceStatus, transcript?: string) {
  const state = useVoiceStore.getState();
  state.setStatus(status);
  if (transcript) state.setTranscript(transcript);
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

class PipecatVoiceProvider implements VoiceProvider {
  private client: PipecatClient | null = null;
  private connection: Promise<void> | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private remoteAudioTrackId: string | null = null;
  private connected = false;
  private listening = false;

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
    void this.remoteAudio.play().catch(() => {
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

  private createClient() {
    return new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      enableCam: false,
      callbacks: {
        onConnected: () => {
          this.connected = true;
        },
        onDisconnected: () => {
          this.connected = false;
          this.listening = false;
          this.stopRemoteAudio();
          setVoice('disconnected');
        },
        onUserStartedSpeaking: () => setVoice('listening'),
        onUserStoppedSpeaking: () => setVoice('processing'),
        onUserTranscript: ({ text, final }) => {
          if (text.trim()) setVoice(final ? 'processing' : 'listening', text.trim());
        },
        onBotLlmStarted: () => setVoice('processing', 'Compass is thinking…'),
        onBotStartedSpeaking: () => setVoice('speaking'),
        onBotOutput: (data: BotOutputData) => {
          if (data.text.trim()) setVoice('speaking', data.text.trim());
        },
        onBotStoppedSpeaking: () => {
          if (this.listening) setVoice('listening', 'Just talk it out…');
        },
        onTrackStarted: (track, participant) => {
          if (track.kind === 'audio' && participant?.local !== true) {
            this.playRemoteAudio(track);
          }
        },
        onTrackStopped: (track, participant) => {
          if (track.kind === 'audio' && participant?.local !== true) {
            this.stopRemoteAudio(track);
          }
        },
        onDeviceError: (error) => {
          setVoice('disconnected', `Microphone unavailable: ${errorText(error)}`);
        },
        onError: (error) => {
          setVoice('disconnected', errorText(error));
        },
      },
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connection) return this.connection;

    this.client ??= this.createClient();
    setVoice('processing', 'Connecting to Compass…');

    const client = this.client;
    this.connection = (async () => {
      await client.initDevices();
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
          },
        });
    })()
      .then(() => {
        this.connected = true;
        this.listening = true;
        setVoice('listening', 'Just talk it out…');
      })
      .catch((error: unknown) => {
        this.stopRemoteAudio();
        this.client = null;
        this.connected = false;
        this.listening = false;
        setVoice('disconnected', errorText(error));
        throw error;
      })
      .finally(() => {
        this.connection = null;
      });

    return this.connection;
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connection = null;
    this.connected = false;
    this.listening = false;
    this.stopRemoteAudio();
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // The agent may have already ended the session; local cleanup still succeeds.
      }
    }
    setVoice('disconnected');
  }

  async startListening(): Promise<void> {
    if (!this.connected) await this.connect();
    this.client?.enableMic(true);
    this.listening = true;
    setVoice('listening');
  }

  async stopListening(): Promise<void> {
    this.client?.enableMic(false);
    this.listening = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isListening(): boolean {
    return this.listening;
  }
}

export const voiceProvider = new PipecatVoiceProvider();
